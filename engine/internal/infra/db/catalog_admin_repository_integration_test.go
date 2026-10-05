package db

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalogadmin"
)

// Cobre o catálogo do painel (N.12) contra um Postgres real descartável (roda só com
// TEST_DATABASE_URL): blocos por classe, edição só dos campos permitidos e sandbox intacto.
func TestCatalogAdminRepository_ConsultaEEdicao(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	scan := func(dest *string, query string, args ...any) {
		t.Helper()
		if err := conn.QueryRowContext(ctx, query, args...).Scan(dest); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := conn.ExecContext(ctx, query, args...); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
	var company, acmeON, acmePN, etf, fii, sandbox, cdb string
	scan(&company, `INSERT INTO companies (name, cnpj, sector, base_growth_pct, quality_multiplier) VALUES ('Acme SA', '12345678000190', 'Varejo', 3, 1) RETURNING id`)
	scan(&acmeON, `INSERT INTO assets (ticker, name, type) VALUES ('ACME3', 'Acme ON', 'acao') RETURNING id`)
	scan(&acmePN, `INSERT INTO assets (ticker, name, type) VALUES ('ACME4', 'Acme PN', 'acao') RETURNING id`)
	scan(&etf, `INSERT INTO assets (ticker, name, type) VALUES ('ETFX11', 'ETF X', 'etf') RETURNING id`)
	scan(&fii, `INSERT INTO assets (ticker, name, type) VALUES ('FIIX11', 'FII X', 'fii') RETURNING id`)
	scan(&sandbox, `INSERT INTO assets (ticker, name, type, is_sandbox) VALUES ('SBX3', 'Sandbox', 'acao', true) RETURNING id`)
	scan(&cdb, `INSERT INTO assets (ticker, name, type) VALUES ('CDB1', 'CDB 1', 'cdb') RETURNING id`)
	exec(`INSERT INTO variable_income_assets (asset_id, company_id, share_class, outstanding_shares) VALUES ($1, $2, 'ON', 1000), ($3, $2, 'PN', 500)`, acmeON, company, acmePN)
	exec(`INSERT INTO variable_income_assets (asset_id, outstanding_shares) VALUES ($1, 100), ($2, 100)`, etf, fii)
	exec(`INSERT INTO variable_income_assets (asset_id, company_id, outstanding_shares) VALUES ($1, $2, 10)`, sandbox, company)
	exec(`INSERT INTO etf_details (asset_id, benchmark_index, methodology_summary) VALUES ($1, 'IBOV', 'Replica o índice.')`, etf)
	exec(`INSERT INTO etf_holdings (etf_asset_id, constituent_name, weight_pct) VALUES ($1, 'Acme', 60), ($1, 'Outra', 40)`, etf)
	exec(`INSERT INTO fii_details (asset_id, fii_type, segment, net_worth) VALUES ($1, 'tijolo', 'Logística', 1000)`, fii)
	exec(`INSERT INTO fixed_income_assets (asset_id, issuer_type, minimum_investment) VALUES ($1, 'banco', 1000)`, cdb)

	repo := NewCatalogAdminRepository(conn)
	byTicker := func(entries []catalogadmin.Entry) map[string]catalogadmin.Entry {
		m := map[string]catalogadmin.Entry{}
		for _, e := range entries {
			m[e.Ticker] = e
		}
		return m
	}

	entries, err := repo.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	all := byTicker(entries)
	if len(entries) != 6 {
		t.Fatalf("len = %d, want 6", len(entries))
	}
	if c := all["ACME3"].Company; c == nil || c.Sector != "Varejo" || c.BaseGrowthPct != 3 || c.QualityMultiplier != 1 {
		t.Errorf("empresa de ACME3 = %+v", c)
	}
	if e := all["ETFX11"].ETF; e == nil || len(e.Holdings) != 2 || e.Holdings[0].Name != "Acme" || e.HoldingsTotalWeightPct != 100 {
		t.Errorf("ETF = %+v", e)
	}
	if f := all["FIIX11"].FII; f == nil || f.FIIType != "tijolo" || all["FIIX11"].Company != nil || all["FIIX11"].ETF != nil {
		t.Errorf("FII = %+v", f)
	}
	if f := all["CDB1"].FixedIncome; f == nil || f.MinimumInvestment != 1000 || f.IssuerType != "banco" {
		t.Errorf("renda fixa = %+v", f)
	}
	if !all["SBX3"].IsSandbox || len(all["SBX3"].Editable()) != 0 {
		t.Errorf("sandbox deveria vir marcado e sem campos editáveis: %+v", all["SBX3"])
	}

	t.Run("edita nome e parâmetros da empresa, valendo pras duas classes do emissor", func(t *testing.T) {
		name, growth, quality := "Acme Brasil ON", 7.5, 1.4
		got, err := repo.Update(ctx, acmeON, catalogadmin.Patch{Name: &name, BaseGrowthPct: &growth, QualityMultiplier: &quality})
		if err != nil {
			t.Fatal(err)
		}
		if got.Name != name || got.Company.BaseGrowthPct != 7.5 || got.Company.QualityMultiplier != 1.4 {
			t.Errorf("entry = %+v", got)
		}
		pn, _ := repo.Get(ctx, acmePN)
		if pn.Name != "Acme PN" || pn.Company.BaseGrowthPct != 7.5 {
			t.Errorf("PN: nome deve ficar e empresa mudar junto: %+v", pn)
		}
	})

	t.Run("edita a metodologia do ETF e limpa com texto vazio", func(t *testing.T) {
		text := "Nova metodologia."
		got, err := repo.Update(ctx, etf, catalogadmin.Patch{Methodology: &text})
		if err != nil || got.ETF.MethodologySummary == nil || *got.ETF.MethodologySummary != text {
			t.Fatalf("err = %v, entry = %+v", err, got.ETF)
		}
		empty := ""
		got, err = repo.Update(ctx, etf, catalogadmin.Patch{Methodology: &empty})
		if err != nil || got.ETF.MethodologySummary != nil {
			t.Fatalf("err = %v, metodologia = %v", err, got.ETF.MethodologySummary)
		}
	})

	t.Run("recusas não gravam nada", func(t *testing.T) {
		bad := 5.0
		if _, err := repo.Update(ctx, sandbox, catalogadmin.Patch{BaseGrowthPct: &bad}); !errors.Is(err, catalogadmin.ErrSandbox) {
			t.Errorf("sandbox: %v", err)
		}
		var fe *catalogadmin.FieldNotEditableError
		if _, err := repo.Update(ctx, fii, catalogadmin.Patch{BaseGrowthPct: &bad}); !errors.As(err, &fe) {
			t.Errorf("campo de empresa em FII: %v", err)
		}
		if _, err := repo.Update(ctx, "00000000-0000-4000-8000-000000000000", catalogadmin.Patch{Name: new(string)}); !errors.Is(err, catalogadmin.ErrNotFound) {
			t.Errorf("inexistente: %v", err)
		}
		sb, _ := repo.Get(ctx, sandbox)
		if sb.Company.BaseGrowthPct != 7.5 { // a empresa é compartilhada com ACME: o sandbox só lê
			t.Errorf("empresa = %+v", sb.Company)
		}
	})
}
