CREATE TABLE "cosmetic_items" (
	"key" varchar(40) PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" varchar(60) NOT NULL,
	"description" varchar(200) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "cosmetic_items_kind_chk" CHECK ("cosmetic_items"."kind" IN ('frame', 'title'))
);
--> statement-breakpoint
CREATE TABLE "user_cosmetics" (
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"item_key" varchar(40) NOT NULL,
	"equipped_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_cosmetics_user_id_kind_pk" PRIMARY KEY("user_id","kind"),
	CONSTRAINT "user_cosmetics_kind_chk" CHECK ("user_cosmetics"."kind" IN ('frame', 'title'))
);
--> statement-breakpoint
ALTER TABLE "user_cosmetics" ADD CONSTRAINT "user_cosmetics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cosmetics" ADD CONSTRAINT "user_cosmetics_item_key_cosmetic_items_key_fk" FOREIGN KEY ("item_key") REFERENCES "public"."cosmetic_items"("key") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "cosmetic_items" ("key", "kind", "name", "description", "sort_order") VALUES
	('frame_aurora', 'frame', 'Aurora', 'Moldura em degradê de verde-água e azul.', 10),
	('frame_oceano', 'frame', 'Oceano', 'Moldura em azul profundo com brilho suave.', 20),
	('frame_crepusculo', 'frame', 'Crepúsculo', 'Moldura em degradê de violeta e rosa.', 30),
	('frame_ametista', 'frame', 'Ametista', 'Moldura em roxo com reflexo claro.', 40),
	('frame_coral', 'frame', 'Coral', 'Moldura em laranja-coral vibrante.', 50),
	('frame_grafite', 'frame', 'Grafite', 'Moldura sóbria em cinza metálico.', 60),
	('title_paciente', 'title', 'Investidor Paciente', 'Para quem prefere esperar a pressa passar.', 10),
	('title_curioso', 'title', 'Mente Curiosa', 'Para quem sempre quer entender o porquê.', 20),
	('title_diversificador', 'title', 'Diversificador', 'Para quem não coloca tudo na mesma cesta.', 30),
	('title_leitor', 'title', 'Leitor de Balanços', 'Para quem gosta de abrir os números da empresa.', 40),
	('title_dividendos', 'title', 'Caçador de Dividendos', 'Para quem aprecia ver a renda chegando.', 50),
	('title_longo_prazo', 'title', 'Visão de Longo Prazo', 'Para quem pensa em anos, não em dias.', 60),
	('title_estrategista', 'title', 'Estrategista', 'Para quem monta o plano antes de agir.', 70),
	('title_sangue_frio', 'title', 'Sangue Frio', 'Para quem mantém a calma quando o mercado oscila.', 80)
ON CONFLICT ("key") DO NOTHING;
