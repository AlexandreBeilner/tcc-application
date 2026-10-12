package corporategovernance

import (
	"context"
	"fmt"
	"sort"

	"tcc-investimentos/engine/internal/domain/paymentschedule"
)

// CompanySchedule é o que o motor sabe da agenda de balanço de uma empresa de capital aberto:
// o ciclo global, o atraso próprio (dias úteis) e o dia de corte do escalonamento.
type CompanySchedule struct {
	CompanyID           string
	Name                string
	Sector              string
	Tickers             []string
	ReportFrequencyDays int
	ReportOffsetDays    int
	ScheduleCutoverDay  int
}

// ScheduleReader lê o dia simulado corrente e a agenda de cada empresa com ação negociável.
type ScheduleReader interface {
	ListCompanySchedules(ctx context.Context) (currentDay int, schedules []CompanySchedule, err error)
}

// CompanyReport é o último balanço já divulgado por uma empresa.
type CompanyReport struct {
	CompanyID       string
	Name            string
	Sector          string
	Tickers         []string
	ReportDay       int
	DaysSinceReport int
}

// RecentReports devolve, por empresa, o último balanço divulgado quando ele saiu entre
// `minDays` e `maxDays` dias antes de `currentDay` (inclusive). Função pura: é o que o backend
// usa para decidir quais assembleias abrir (o balanço mais o atraso de abertura, até o limite
// de recuperação depois de uma parada). Ordem estável por nome da empresa e id.
func RecentReports(currentDay int, schedules []CompanySchedule, minDays, maxDays int) []CompanyReport {
	var out []CompanyReport
	if currentDay <= 0 {
		return out
	}
	for _, s := range schedules {
		// DaysSinceReport conta até dayIndex+1: o dia corrente é o "novo dia" do último tick.
		days, ok := paymentschedule.DaysSinceReport(currentDay-1, s.ReportFrequencyDays, s.ReportOffsetDays, s.ScheduleCutoverDay)
		if !ok || days < minDays || days > maxDays {
			continue
		}
		out = append(out, CompanyReport{
			CompanyID: s.CompanyID, Name: s.Name, Sector: s.Sector, Tickers: s.Tickers,
			ReportDay: currentDay - days, DaysSinceReport: days,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Name != out[j].Name {
			return out[i].Name < out[j].Name
		}
		return out[i].CompanyID < out[j].CompanyID
	})
	return out
}

// ReportsResult é o corpo de GET /governance/reports.
type ReportsResult struct {
	SimulatedDay int
	Reports      []CompanyReport
}

// WithSchedules liga a leitura de agendas (sem ela, RecentReports falha).
func (s *Service) WithSchedules(r ScheduleReader) *Service {
	s.schedules = r
	return s
}

// RecentReports valida a janela e devolve os balanços recentes (ver a função homônima).
func (s *Service) RecentReports(ctx context.Context, minDays, maxDays int) (ReportsResult, error) {
	if minDays < 0 || maxDays < minDays || maxDays > 400 {
		return ReportsResult{}, fmt.Errorf("%w: janela de dias inválida", ErrInvalidInput)
	}
	if s.schedules == nil {
		return ReportsResult{}, fmt.Errorf("%w: agenda de balanços indisponível", ErrInvalidInput)
	}
	day, schedules, err := s.schedules.ListCompanySchedules(ctx)
	if err != nil {
		return ReportsResult{}, err
	}
	return ReportsResult{SimulatedDay: day, Reports: RecentReports(day, schedules, minDays, maxDays)}, nil
}
