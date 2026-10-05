package db

import (
	"context"
	"database/sql"

	"tcc-investimentos/engine/internal/domain/enginesetting"
)

// EngineSettingsRepository persiste os parâmetros editáveis do motor (tarefa N.7) em
// engine_settings. Implementa enginesetting.Repository.
type EngineSettingsRepository struct {
	db *sql.DB
}

func NewEngineSettingsRepository(db *sql.DB) *EngineSettingsRepository {
	return &EngineSettingsRepository{db: db}
}

func (r *EngineSettingsRepository) Overrides(ctx context.Context) (map[enginesetting.Key]enginesetting.Override, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT key, value, updated_by, updated_at, version FROM engine_settings`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	out := map[enginesetting.Key]enginesetting.Override{}
	for rows.Next() {
		var key string
		var o enginesetting.Override
		if err := rows.Scan(&key, &o.Value, &o.UpdatedBy, &o.UpdatedAt, &o.Version); err != nil {
			return nil, err
		}
		out[enginesetting.Key(key)] = o
	}
	return out, rows.Err()
}

// Save grava ou troca o valor da chave, subindo a versão a cada troca.
func (r *EngineSettingsRepository) Save(ctx context.Context, key enginesetting.Key, value int, updatedBy string) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO engine_settings (key, value, updated_by) VALUES ($1, $2, $3)
		ON CONFLICT (key) DO UPDATE
		SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now(), version = engine_settings.version + 1`,
		string(key), value, updatedBy)
	return err
}

func (r *EngineSettingsRepository) Delete(ctx context.Context, key enginesetting.Key) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM engine_settings WHERE key = $1`, string(key))
	return err
}
