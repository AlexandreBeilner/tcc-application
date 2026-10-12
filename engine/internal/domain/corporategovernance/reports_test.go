package corporategovernance

import (
	"context"
	"errors"
	"reflect"
	"testing"
)

type fakeSchedules struct {
	day       int
	schedules []CompanySchedule
	err       error
}

func (f fakeSchedules) ListCompanySchedules(context.Context) (int, []CompanySchedule, error) {
	return f.day, f.schedules, f.err
}

func TestRecentReports(t *testing.T) {
	legacy := CompanySchedule{CompanyID: "b", Name: "Beta", ReportFrequencyDays: 91}
	// Offset de 2 dias úteis: o balanço do ciclo 0 sai depois do dia 91.
	offset := CompanySchedule{CompanyID: "a", Name: "Alfa", ReportFrequencyDays: 91, ReportOffsetDays: 2}

	tests := []struct {
		name         string
		day          int
		schedules    []CompanySchedule
		min, max     int
		wantCompany  []string
		wantReportAt []int
	}{
		{name: "dois dias depois do balanço legado", day: 93, schedules: []CompanySchedule{legacy}, min: 2, max: 9,
			wantCompany: []string{"b"}, wantReportAt: []int{91}},
		{name: "um dia depois ainda não entra", day: 92, schedules: []CompanySchedule{legacy}, min: 2, max: 9},
		{name: "depois do limite de recuperação não entra", day: 91 + 10, schedules: []CompanySchedule{legacy}, min: 2, max: 9},
		{name: "limite superior inclusive", day: 91 + 9, schedules: []CompanySchedule{legacy}, min: 2, max: 9,
			wantCompany: []string{"b"}, wantReportAt: []int{91}},
		{name: "antes do primeiro balanço", day: 50, schedules: []CompanySchedule{legacy}, min: 0, max: 400},
		{name: "dia zero", day: 0, schedules: []CompanySchedule{legacy}, min: 0, max: 400},
		{name: "ordena por nome", day: 91 + 5, schedules: []CompanySchedule{legacy, {CompanyID: "c", Name: "Alfa", ReportFrequencyDays: 91}}, min: 0, max: 9,
			wantCompany: []string{"c", "b"}, wantReportAt: []int{91, 91}},
		{name: "ciclo sem frequência é ignorado", day: 100, schedules: []CompanySchedule{{CompanyID: "z", Name: "Z"}}, min: 0, max: 400},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := RecentReports(tc.day, tc.schedules, tc.min, tc.max)
			var companies []string
			var days []int
			for _, r := range got {
				companies = append(companies, r.CompanyID)
				days = append(days, r.ReportDay)
				if r.DaysSinceReport != tc.day-r.ReportDay {
					t.Errorf("DaysSinceReport = %d, esperado %d", r.DaysSinceReport, tc.day-r.ReportDay)
				}
			}
			if !reflect.DeepEqual(companies, tc.wantCompany) || !reflect.DeepEqual(days, tc.wantReportAt) {
				t.Errorf("empresas %v dias %v, esperado %v %v", companies, days, tc.wantCompany, tc.wantReportAt)
			}
		})
	}

	t.Run("offset desloca o dia do balanço", func(t *testing.T) {
		got := RecentReports(91+12, []CompanySchedule{offset}, 0, 12)
		if len(got) != 1 || got[0].ReportDay <= 91 {
			t.Fatalf("esperado balanço depois do dia 91, veio %+v", got)
		}
	})
}

func TestService_RecentReports(t *testing.T) {
	svc := NewService(nil, nil).WithSchedules(fakeSchedules{
		day: 93, schedules: []CompanySchedule{{CompanyID: "b", Name: "Beta", ReportFrequencyDays: 91}},
	})
	res, err := svc.RecentReports(context.Background(), 2, 9)
	if err != nil || res.SimulatedDay != 93 || len(res.Reports) != 1 {
		t.Fatalf("res = %+v err = %v", res, err)
	}
	for name, w := range map[string][2]int{"mínimo negativo": {-1, 5}, "máximo menor": {5, 2}, "máximo enorme": {0, 401}} {
		if _, err := svc.RecentReports(context.Background(), w[0], w[1]); !errors.Is(err, ErrInvalidInput) {
			t.Errorf("%s: err = %v, esperado ErrInvalidInput", name, err)
		}
	}
	if _, err := NewService(nil, nil).RecentReports(context.Background(), 0, 5); !errors.Is(err, ErrInvalidInput) {
		t.Errorf("sem leitor: err = %v", err)
	}
	boom := errors.New("banco fora")
	if _, err := NewService(nil, nil).WithSchedules(fakeSchedules{err: boom}).RecentReports(context.Background(), 0, 5); !errors.Is(err, boom) {
		t.Errorf("erro do leitor deve propagar, veio %v", err)
	}
}
