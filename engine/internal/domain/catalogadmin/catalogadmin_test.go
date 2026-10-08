package catalogadmin

import (
	"context"
	"errors"
	"strings"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
)

func ptr[T any](v T) *T { return &v }

func TestPatchValidate(t *testing.T) {
	tests := []struct {
		name      string
		assetType catalog.AssetType
		sandbox   bool
		patch     Patch
		want      error
		wantField string
	}{
		{name: "ação com crescimento e qualidade válidos", assetType: catalog.AssetAcao, patch: Patch{BaseGrowthPct: ptr(5.0), QualityMultiplier: ptr(1.2)}},
		{name: "nome válido em FII", assetType: catalog.AssetFII, patch: Patch{Name: ptr("Fundo Novo")}},
		{name: "metodologia em ETF", assetType: catalog.AssetETF, patch: Patch{Methodology: ptr("Replica o índice.")}},
		{name: "patch vazio", assetType: catalog.AssetAcao, patch: Patch{}, want: ErrNothingToUpdate},
		{name: "sandbox recusado", assetType: catalog.AssetAcao, sandbox: true, patch: Patch{Name: ptr("X")}, want: ErrSandbox},
		{name: "nome vazio", assetType: catalog.AssetAcao, patch: Patch{Name: ptr("   ")}, want: ErrInvalidName},
		{name: "nome longo demais", assetType: catalog.AssetAcao, patch: Patch{Name: ptr(strings.Repeat("a", 101))}, want: ErrInvalidName},
		{name: "crescimento zera o fator", assetType: catalog.AssetAcao, patch: Patch{BaseGrowthPct: ptr(-100.0)}, want: catalog.ErrInvalidBaseGrowthPct},
		{name: "qualidade acima do teto", assetType: catalog.AssetAcao, patch: Patch{QualityMultiplier: ptr(2.5)}, want: catalog.ErrInvalidQualityMultiplier},
		{name: "qualidade zero", assetType: catalog.AssetAcao, patch: Patch{QualityMultiplier: ptr(0.0)}, want: catalog.ErrInvalidQualityMultiplier},
		{name: "metodologia longa demais", assetType: catalog.AssetETF, patch: Patch{Methodology: ptr(strings.Repeat("m", 1001))}, want: ErrInvalidMethodology},
		{name: "crescimento em FII", assetType: catalog.AssetFII, patch: Patch{BaseGrowthPct: ptr(3.0)}, wantField: FieldBaseGrowthPct},
		{name: "qualidade em ETF", assetType: catalog.AssetETF, patch: Patch{QualityMultiplier: ptr(1.0)}, wantField: FieldQualityMultiplier},
		{name: "metodologia em ação", assetType: catalog.AssetAcao, patch: Patch{Methodology: ptr("x")}, wantField: FieldMethodology},
		{name: "nome em renda fixa", assetType: catalog.AssetCDB, patch: Patch{Name: ptr("CDB Novo")}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.patch.Validate(tc.assetType, tc.sandbox)
			if tc.wantField != "" {
				var fe *FieldNotEditableError
				if !errors.As(err, &fe) || fe.Field != tc.wantField {
					t.Fatalf("erro = %v, queria FieldNotEditableError(%s)", err, tc.wantField)
				}
				return
			}
			if !errors.Is(err, tc.want) {
				t.Fatalf("erro = %v, queria %v", err, tc.want)
			}
		})
	}
}

func TestEditableFields(t *testing.T) {
	if got := EditableFields(catalog.AssetAcao, true); len(got) != 0 {
		t.Fatalf("sandbox editável: %v", got)
	}
	if got := EditableFields(catalog.AssetAcao, false); len(got) != 3 {
		t.Fatalf("ação: %v", got)
	}
}

type fakeRepo struct {
	entry   Entry
	updated *Patch
}

func (f *fakeRepo) List(context.Context) ([]Entry, error)      { return []Entry{f.entry}, nil }
func (f *fakeRepo) Get(context.Context, string) (Entry, error) { return f.entry, nil }
func (f *fakeRepo) Update(_ context.Context, _ string, p Patch) (Entry, error) {
	f.updated = &p
	return f.entry, nil
}

func TestServiceUpdate(t *testing.T) {
	t.Run("recusa sem gravar", func(t *testing.T) {
		repo := &fakeRepo{entry: Entry{Type: catalog.AssetAcao}}
		_, err := NewService(repo).Update(context.Background(), "id", Patch{QualityMultiplier: ptr(9.0)})
		if !errors.Is(err, catalog.ErrInvalidQualityMultiplier) || repo.updated != nil {
			t.Fatalf("err = %v, gravou = %v", err, repo.updated != nil)
		}
	})
	t.Run("sandbox recusado", func(t *testing.T) {
		repo := &fakeRepo{entry: Entry{Type: catalog.AssetAcao, IsSandbox: true}}
		_, err := NewService(repo).Update(context.Background(), "id", Patch{Name: ptr("x")})
		if !errors.Is(err, ErrSandbox) || repo.updated != nil {
			t.Fatalf("err = %v", err)
		}
	})
	t.Run("grava com o nome aparado", func(t *testing.T) {
		repo := &fakeRepo{entry: Entry{Type: catalog.AssetAcao}}
		if _, err := NewService(repo).Update(context.Background(), "id", Patch{Name: ptr("  Nome  ")}); err != nil {
			t.Fatal(err)
		}
		if repo.updated == nil || *repo.updated.Name != "Nome" {
			t.Fatalf("patch gravado = %+v", repo.updated)
		}
	})
}
