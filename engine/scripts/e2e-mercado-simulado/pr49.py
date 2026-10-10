"""Teste ponta a ponta adversarial do PR #49 (Fase U + achado 025) contra a stack tccsim (gateway 8100).
Rodar da raiz do repo depois de seedar e rodar ticks:  cd engine/scripts/e2e-mercado-simulado && python3 pr49.py
Cada caso imprime ok/FALHA; sai com código 1 se algum falhar. Muta fii_details e dispara eventos: só em stack descartável."""
import sys,json,time,uuid
sys.path.insert(0,'.')
from lib import *
fails=[]
def check(name,cond,detail=""):
    print(("   ok    " if cond else "   FALHA ")+name+(f" [{detail}]" if detail and not cond else ""))
    if not cond: fails.append(name)
def sec(t): print("\n== "+t)
st,d=req("POST","/auth/login",{"email":"admin@sim.test","password":"Admin1234!"}); AT=d["token"]
probe=User("pr49p"+uuid.uuid4().hex[:8],"x")
A=probe.g("/market/assets?include_sandbox=false")[1]["assets"]
FI_ASSET=next(a for a in probe.g("/market/assets?include_sandbox=false")[1]["assets"] if a["type"] not in ("acao","etf","fii"))
FII=[a for a in A if a["type"]=="fii"]; ACAO=[a for a in A if a["type"]=="acao"]; ETF=[a for a in A if a["type"]=="etf"]
def detail(u,aid): return u.g("/market/assets/"+aid)
def vp(aid):
    r=sql("market",f"select coalesce(f.net_worth,f.portfolio_value), v.outstanding_shares from fii_details f join variable_income_assets v on v.asset_id=f.asset_id where f.asset_id='{aid}'")[0]
    return (float(r[0]) if r[0] else None, int(r[1]) if r[1] else None)

sec("A. API: P/VP do FII bate com preco / (VP por cota) calculado a parte")
check("catalogo tem 5 FIIs",len(FII)==5,len(FII))
for a in FII:
    st,d=detail(probe,a["id"]); asset=d["asset"]; f=asset.get("fii")
    base,shares=vp(a["id"]); price=asset.get("current_price")
    want=price/(base/shares)
    got=(f or {}).get("price_to_book_value")
    check(f"{a['ticker']} P/VP presente e correto (~{want:.4f})",got is not None and abs(got-want)<=0.005*want+0.0051,f"got={got} want={want}")
    check(f"{a['ticker']} sem bloco de indicadores de empresa",asset.get("equity") is None)
for a in (ACAO[:2]+ETF[:1]):
    st,d=detail(probe,a["id"]); asset=d["asset"]
    check(f"{a['ticker']} ({a['type']}) nao ganha price_to_book_value de FII",asset.get("fii") is None)
    if a["type"]=="etf": check("ETF sem indicadores de empresa", "indicators" not in json.dumps(asset.get("etf") or {}))

sec("B. API: entradas invalidas")
check("sem token -> 401",req("GET","/market/assets/"+FII[0]["id"])[0]==401)
check("token lixo -> 401",req("GET","/market/assets/"+FII[0]["id"],t="x.y.z")[0]==401)
st,_=detail(probe,"nao-e-uuid"); check("id malformado -> 4xx (nunca 5xx)",400<=st<500,st)
st,_=detail(probe,str(uuid.uuid4())); check("id inexistente -> 404",st==404,st)
st,_=detail(probe,FII[0]["id"]+"%27%3B%20DROP%20TABLE%20assets%3B--"); check("injecao no id -> 4xx",400<=st<500,st)

sec("C. Motor: dados degenerados de FII nao quebram o tick nem a API")
tijolos=[a for a in FII if sql("market",f"select fii_type from fii_details where asset_id='{a['id']}'")[0][0]=="tijolo"]
papeis=[a for a in FII if a not in tijolos]
orig={a["id"]:sql("market",f"select segment, net_worth, portfolio_value from fii_details where asset_id='{a['id']}'")[0] for a in FII}
t0,t1,p0=tijolos[0],tijolos[1],papeis[0]
def run_ticks(n,label,assets=()):
    # fim de semana simulado devolve quotes_count=0 (mercado fechado, S.11): "ok" = nenhum erro,
    # dia avanca, houve cotacao em algum dia util e cada ativo mutado ganhou cotacao nova.
    ok=True; quoted=0; first=None
    for _ in range(n):
        try: tk=tick(); first=first or tk["day"]; quoted+=1 if tk.get("quotes_count",0)>0 else 0
        except Exception as e: print("   tick erro",e); ok=False
    check(f"{n} ticks ok ({label})",ok and quoted>0,quoted)
    for a in assets:
        c=int(sql("market",f"select count(*) from asset_quotes where asset_id='{a['id']}' and simulated_day>={first}")[0][0])
        check(f"{a['ticker']} recebeu cotacao nova durante os ticks ({label})",c>0,c)
sql("market",f"update fii_details set segment=NULL where asset_id='{t0['id']}'")
sql("market",f"update fii_details set segment='Segmento Inexistente' where asset_id='{t1['id']}'")
run_ticks(5,"segmento NULL e desconhecido",(t0,t1))
for a in (t0,t1):
    st,d=detail(probe,a["id"]); check(f"{a['ticker']} detalhe 200 com segmento degenerado",st==200,st)
    check(f"{a['ticker']} ainda tem cotacao e P/VP finito",d["asset"].get("current_price",0)>0 and 0<(d["asset"].get("fii") or {}).get("price_to_book_value",-1)<5,d["asset"].get("fii"))
sql("market",f"update fii_details set net_worth=NULL where asset_id='{t0['id']}'")
sql("market",f"update fii_details set portfolio_value=NULL where asset_id='{p0['id']}'")
run_ticks(5,"valor-base NULL (tijolo e papel)",(t0,p0))
for a in (t0,p0):
    st,d=detail(probe,a["id"]); f=d["asset"].get("fii") or {}
    check(f"{a['ticker']} sem valor-base: 200 e P/VP omitido (nunca 0/NaN)",st==200 and "price_to_book_value" not in f,f)
    check(f"{a['ticker']} sem valor-base: segue cotado",d["asset"].get("current_price",0)>0)
shares_t1=vp(t1["id"])[1]
sql("market",f"update variable_income_assets set outstanding_shares=NULL where asset_id='{t1['id']}'")
run_ticks(3,"cotas em circulacao NULL",(t1,))
st,d=detail(probe,t1["id"]); check("FII sem cotas: 200 e P/VP omitido",st==200 and "price_to_book_value" not in (d["asset"].get("fii") or {}),d["asset"].get("fii"))
# restaura
for a in FII:
    seg,nw,pv=orig[a["id"]]
    sql("market",f"update fii_details set segment={'NULL' if not seg else repr(seg)}, net_worth={nw or 'NULL'}, portfolio_value={pv or 'NULL'} where asset_id='{a['id']}'")
sql("market",f"update variable_income_assets set outstanding_shares={shares_t1} where asset_id='{t1['id']}'")

sec("D. Usuario real negociando FII: gate, validacao, saldo")
u=User("pr49t"+uuid.uuid4().hex[:8],"trader")
st,d=u.order(FII[0]["id"],"buy","market",1); check("FII travado antes da licao 2.10 -> 403",st==403,(st,d))
complete_lessons(u,"2.10")
clock=u.g("/market/clock")[1]; print("   relogio:",json.dumps(clock)[:160])
tgt=FII[2]; price=detail(u,tgt["id"])[1]["asset"]["current_price"]
cash0=u.acct()["cashBalance"]
for label,body in [("quantidade 0",0),("quantidade negativa",-5),("quantidade fracionada",1.5),("quantidade absurda",10**12),("quantidade string","abc")]:
    st,d=u.order(tgt["id"],"buy","market",body); check(f"compra {label} -> 4xx (nunca 5xx)",400<=st<500,(st,d))
st,d=u.order(tgt["id"],"sell","market",1); check("venda sem posicao -> 4xx",400<=st<500,(st,d))
st,d=u.order(tgt["id"],"buy","limit",1,-1); check("limite com preco negativo -> 4xx",400<=st<500,(st,d))
st,d=u.order(tgt["id"],"buy","market",int(cash0//price*5)); check("compra acima do saldo -> 4xx",400<=st<500,(st,d))
check("saldo intacto apos pedidos invalidos",abs(u.acct()["cashBalance"]-cash0)<0.01)
q=max(1,int(cash0*0.3/price))
st,d=u.order(tgt["id"],"buy","market",q); check("compra valida de FII -> 201",st==201,(st,d))
if st==201:
    acc=u.acct(); pos=[p for p in acc["positions"] if p["ticker"]==tgt["ticker"]]
    check("posicao criada com a quantidade comprada",pos and pos[0]["quantity"]==q,pos)
    check("saldo debitado ~ q x preco",0<cash0-acc["cashBalance"]<=q*price*1.1+1,(cash0,acc["cashBalance"]))
    st,d=u.order(tgt["id"],"sell","market",q+1); check("vender mais do que tem -> 4xx",400<=st<500,(st,d))
    # proventos: avanca ate pagar
    paid=0
    for _ in range(100):
        tk=tick(); paid+=tk.get("dividends_paid_count",0)
        if u.acct().get("totalDividendsReceived",0)>0 or paid>0 and u.acct()["cashBalance"]>acc["cashBalance"]: break
    acc2=u.acct(); check("detentor de FII recebe provento (saldo sobe sem ordem)",acc2["cashBalance"]>acc["cashBalance"],(acc["cashBalance"],acc2["cashBalance"]))
    st,d=u.order(tgt["id"],"sell","market",q)
    check("venda total valida -> 201 ou mercado fechado 422",st in(201,422),(st,d))

sec("E. Evento macro com alvo invalido e recusado (achado 028); alvo valido segue aceito")
def macro(targets):
    return req("POST","/admin/macro-events",{"template_key":"legislacao-ambiental-mineracao","targets":targets},AT)
n0=int(sql("market","select count(*) from macro_events")[0][0])
etf=ETF[0]; acao=ACAO[0]; fi=FI_ASSET
for label,targets in [("FII",[{"asset_id":FII[3]["id"]}]),("ETF",[{"asset_id":etf["id"]}]),("renda fixa",[{"asset_id":fi["id"]}]),
                      ("acao + FII (evento inteiro recusado)",[{"asset_id":acao["id"]},{"asset_id":FII[3]["id"]}]),
                      ("ativo inexistente",[{"asset_id":str(uuid.uuid4())}]),("id malformado",[{"asset_id":"'; DROP TABLE assets;--"}])]:
    st,d=macro(targets); check(f"alvo {label} -> 400",st==400,(st,str(d)[:140]))
check("nenhum evento gravado pelas recusas",int(sql("market","select count(*) from macro_events")[0][0])==n0)
st,d=macro([{"asset_id":acao["id"]}]); check("alvo acao -> 201",st==201,(st,str(d)[:140]))
st,d=macro([{"sector":"Mineração"}]); check("alvo de setor -> 201",st==201,(st,str(d)[:140]))
run_ticks(3,"apos eventos macro",(FII[3],))
st,d=detail(probe,FII[3]["id"]); check("FII segue consultavel e cotado",st==200 and d["asset"].get("current_price",0)>0)

sec("F. Invariantes financeiras do motor depois de tudo")
INV=open("inv.sql").read()
r=subprocess.run(COMPOSE+["exec","-T","postgres","psql","-U","tcc","-d","market","-At","-F"," | "],input=INV,capture_output=True,text=True)
bad=[l for l in r.stdout.strip().split("\n") if l and not l.endswith("| 0")]
check("inv.sql: todas as invariantes em 0",not bad and r.returncode==0,bad)
print("\nRESUMO:", "TUDO OK" if not fails else f"{len(fails)} FALHA(S): {fails}")
sys.exit(1 if fails else 0)
