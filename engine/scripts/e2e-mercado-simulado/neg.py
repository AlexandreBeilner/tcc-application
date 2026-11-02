import sys,threading,uuid;sys.path.insert(0,'.')
from lib import *
# Sufixo por execução: o script pode rodar de novo na mesma stack sem esbarrar nos 409 da anterior.
RUN=uuid.uuid4().hex[:6]
R=[]
def chk(name,got,ok,extra=""):
    good = got in ok if isinstance(ok,(list,tuple,set)) else got==ok
    R.append((good,name,got,extra)); print(("ok   " if good else "FALHA"),name,got,str(extra)[:160])
a=User("neg_a"+RUN,"x"); b=User("neg_b"+RUN,"x")
complete_lessons(a); complete_lessons(b)
A={x["ticker"]:x for x in a.g("/market/assets?include_sandbox=true")[1]["assets"]}
V=A["VALR3"]["id"]; S3=A["SAND3"]["id"]; CDB=A["CDB2027"]["id"]
# As ordens abaixo pressupõem pregão com o book cotado: fim de semana simulado responde 422
# market_closed (S.11) e, sem Market Maker cotando, a ordem a mercado volta 201 sem executar nada.
ensure_two_sided_book(a,V)
# auth
chk("sem token orders",req("POST","/market/orders",{"asset_id":V,"side":"buy","type":"market","quantity":1})[0],401)
chk("token lixo",req("GET","/market/me/account",t="abc")[0],401)
st,d=req("GET","/market/me/account",t=a.t.split(".")[0]+"."+a.t.split(".")[1]+".AAAA"); chk("jwt assinatura adulterada",st,401)
# JWT alg none
import base64
def b64(x): return base64.urlsafe_b64encode(json.dumps(x).encode()).rstrip(b"=").decode()
none=b64({"alg":"none","typ":"JWT"})+"."+b64({"sub":a.id,"role":"admin"})+"."
chk("jwt alg=none",req("GET","/admin/ping",t=none)[0],401)
chk("user comum em rota admin",a.g("/admin/ping")[0],403)
chk("user comum dispara evento macro",a.p("/admin/macro-events",{"template_key":"x"})[0],403)
chk("user comum acessa /admin/macro-events",a.g("/admin/macro-events")[0],403)
# register abuse
st,d=req("POST","/auth/register",{"name":"x","email":f"neg_r{RUN}@sim.test","username":f"neg_r1{RUN}","password":"Senha1234!","role":"admin"}); chk("register com role=admin",d["user"]["role"] if st==201 else st,"user")
chk("register e-mail duplicado",req("POST","/auth/register",{"name":"x","email":f"NEG_R{RUN}@sim.test","username":f"neg_r2{RUN}","password":"Senha1234!"})[0],409)
chk("register username maiúsculo dup",req("POST","/auth/register",{"name":"x","email":f"o{RUN}@sim.test","username":f"NEG_R1{RUN}","password":"Senha1234!"})[0],409)
chk("register senha curta",req("POST","/auth/register",{"name":"x","email":"o2@sim.test","username":"abcd","password":"1"})[0],400)
chk("register username com espaço/sql",req("POST","/auth/register",{"name":"x","email":"o3@sim.test","username":"a'; drop","password":"Senha1234!"})[0],400)
chk("register nome com <script>",req("POST","/auth/register",{"name":"<script>alert(1)</script>","email":f"o4{RUN}@sim.test","username":f"xss_{RUN}","password":"Senha1234!"})[0],[201,400])
chk("login senha errada",req("POST","/auth/login",{"email":f"neg_a{RUN}@sim.test","password":"errada123"})[0],401)
chk("login email inexistente = mesmo status",req("POST","/auth/login",{"email":"nao@sim.test","password":"errada123"})[0],401)
# validação de ordens
def o(u,**k):
    b={"asset_id":V,"side":"buy","type":"market","quantity":1}; b.update(k); return u.p("/market/orders",b)
chk("qty 0",o(a,quantity=0)[0],400); chk("qty negativa",o(a,quantity=-5)[0],400); chk("qty fracionária",o(a,quantity=1.5)[0],400)
chk("qty string",o(a,quantity="10")[0],[400]); chk("qty gigante 1e18",o(a,quantity=10**18)[0],[400,422]); chk("qty 2^63",o(a,quantity=2**63)[0],[400,422])
chk("limit sem preço",o(a,type="limit")[0],400); chk("limit preço 0",o(a,type="limit",price=0)[0],400); chk("limit preço negativo",o(a,type="limit",price=-1)[0],400)
chk("limit preço NaN-string",o(a,type="limit",price="NaN")[0],400); chk("limit preço 1e308",o(a,type="limit",price=1e308,quantity=1)[0],[400,422])
chk("limit preço 0.001",o(a,type="limit",price=0.001)[0],[201,400]) 
chk("limit preço 3 casas",o(a,type="limit",price=90.123)[0],[201,400])
chk("side inválido",o(a,side="hold")[0],400); chk("type inválido",o(a,type="stop")[0],400)
chk("asset_id não UUID",o(a,asset_id="1 OR 1=1")[0],400)
# "...-00000000dead" tem nibble de versão 0 (RFC4122 exige 1-5): o Zod do
# corpo da ordem (`z.string().uuid()`, estrito) rejeita com 400 antes de
# chegar no motor, enquanto o `:id` de path (regex solta) deixaria passar
# pro 404 do motor — inconsistência de validação já mapeada nesta sessão
# (S.9), não um bug: nenhuma das duas respostas vaza dado nem quebra
# invariante. Usar aqui um UUID v4 sintaticamente válido (mas inexistente)
# pra exercitar de fato o 404 do motor, não a rejeição de formato do Zod.
chk("asset_id inexistente",o(a,asset_id="00000000-0000-4000-8000-000000000000")[0],404)
chk("corpo vazio",a.p("/market/orders",{})[0],400)
chk("user_id injetado no corpo (IDOR)",o(a,user_id=b.id)[0],[201,400,422,403])
b_before=b.acct()["cashBalance"]
chk("compra a mercado de renda fixa via /orders",o(a,asset_id=CDB)[0],400)
# saldo insuficiente: pós-A.2 o Mercado Ao Vivo não tem contraparte sintética —
# uma ordem a mercado maior que o book simplesmente preenche parcial (ou
# zero) e devolve 201, nunca 422 só por "não teria como pagar tudo". O
# 422 (ErrInsufficientBalance) só dispara se o CUSTO DO QUE REALMENTE
# preencheu excede o saldo (orderexecution.validateFunds) — condição que
# não dá pra forçar de fora sem controlar a profundidade do book. Garantia
# que dá pra checar de fora: nunca preenche além do que o saldo paga.
cash_a=a.acct()["cashBalance"]
st,d=o(a,quantity=10_000_000)
# O motor recusa (422 saldo insuficiente) quando o custo do que preencheria excede o saldo; as duas
# respostas (201 parcial, 422 recusa) respeitam a garantia. Verificado igual na linha de base do PR #49.
chk("compra > saldo (201 parcial ou 422 recusa, nunca estoura saldo)",st,(201,422),d)
if st==422: chk("compra > saldo recusada: saldo intacto",a.acct()["cashBalance"],cash_a)
if st==201: chk("compra > saldo: nunca preenche custo maior que o saldo",sum(f["price"]*f["quantity"] for f in d["fills"])<=cash_a,True,d)
d_user=User("neg_d"+RUN,"x"); complete_lessons(d_user)  # usuário isolado: `a` já tem posição de VALR3 desde o IDOR acima
chk("venda sem posição",o(d_user,side="sell",quantity=1)[0],422)
# cancelamento alheio
st,d=o(a,type="limit",price=50.0,quantity=10); chk("limit longe do mercado (50)",st,201,d)
oid=d.get("order_id") if st==201 else None
if oid:
    chk("cancel ordem alheia (IDOR)",b.p(f"/market/orders/{oid}/cancel")[0],[403,404],b.p(f"/market/orders/{oid}/cancel"))
    chk("cancel própria",a.p(f"/market/orders/{oid}/cancel")[0],204)
    chk("cancel repetido",a.p(f"/market/orders/{oid}/cancel")[0],[404,409,422])
chk("cancel id inválido",a.p("/market/orders/abc/cancel")[0],400)
chk("cancel id inexistente",a.p("/market/orders/00000000-0000-0000-0000-00000000dead/cancel")[0],404)
# limit preço absurdo comprando: fat-finger
st,d=o(a,type="limit",price=1000.0,quantity=5); chk("limit compra a 1000 (cruza; preenche ao melhor ask, não ao limite)",st,201,d)
if st==201 and d["fills"]: chk("preço de fill <= limite e ao ask",max(f["price"] for f in d["fills"])<200,True,d["fills"])
# sandbox
st,d=o(a,asset_id=S3,quantity=5); chk("sandbox compra",st,201)
# renda fixa
FIB=lambda **k:a.p("/market/fixed-income/purchases",{"asset_id":CDB,"amount":100,**k})
chk("FI amount 0",FIB(amount=0)[0],400); chk("FI amount negativo",FIB(amount=-100)[0],400); chk("FI abaixo do mínimo",FIB(amount=1)[0],[400,422])
chk("FI amount > saldo",FIB(amount=10**9)[0],422); chk("FI amount string",FIB(amount="abc")[0],400)
chk("FI acao como renda fixa",a.p("/market/fixed-income/purchases",{"asset_id":V,"amount":100})[0],400)
chk("FI resgate sem posição",a.p("/market/fixed-income/redemptions",{"asset_id":A["LTN2027"]["id"]})[0],[404,422])
chk("FI simular",a.g(f"/market/fixed-income/simulate?asset_id={CDB}&amount=1000&days=365")[0],[200,400])
# leitura
chk("asset inexistente",a.g("/market/assets/00000000-0000-0000-0000-00000000dead")[0],404)
chk("asset id lixo",a.g("/market/assets/abc")[0],400)
chk("quotes days=0",a.g(f"/market/assets/{V}/quotes?days=0")[0],400); chk("quotes days=-1",a.g(f"/market/assets/{V}/quotes?days=-1")[0],400)
chk("quotes days=10^9",a.g(f"/market/assets/{V}/quotes?days=1000000000")[0],[200,400])
chk("assets type inválido",a.g("/market/assets?type=foo")[0],400)
chk("events limit=101",a.g("/market/me/events?limit=101")[0],400)
# perfil público / privacidade
pr=b.g(f"/users/{a.id}/profile"); chk("perfil público 200",pr[0],200); s=json.dumps(pr[1]).lower()
chk("perfil não vaza saldo/patrimônio absoluto",any(k in s for k in("cashbalance","networth","net_worth","patrimonio","currentbalance")),False)
chk("perfil de id inexistente",b.g("/users/00000000-0000-0000-0000-00000000dead/profile")[0],404)
chk("perfil id lixo",b.g("/users/abc/profile")[0],[400,404])
chk("busca usuário q vazio",b.g("/users/search?q=")[0],[200,400])
chk("busca com curinga %",b.g("/users/search?q=%25")[0],[200,400])
rk=b.g("/ranking")[1]; s=json.dumps(rk).lower()
chk("ranking não vaza patrimônio absoluto",any(k in s for k in("networth","net_worth","patrimonio","cashbalance")),False,list(rk)[:5] if isinstance(rk,dict) else "")
# amizade: payload real é addresseeUsername (schemas.ts), não addresseeId
chk("amizade consigo mesmo",a.p("/friendships",{"addresseeUsername":a.name})[0],[400,422,409])
st,d=a.p("/friendships",{"addresseeUsername":b.name}); chk("pedido de amizade",st,201,d)
st2,d2=a.p("/friendships",{"addresseeUsername":b.name}); chk("pedido duplicado",st2,[409,400,422])
# concorrência: double spend
c=User("neg_c"+RUN,"x"); complete_lessons(c); ensure_two_sided_book(c,V)
N_ORDERS=12; QTY=90
# Evidência registrada antes das threads: saldo inicial e melhor preço de venda (best_ask) de VALR3.
initial_balance=c.acct()["cashBalance"]
best_ask=c.g(f"/market/assets/{V}/book")[1]["book"]["best_ask"]
res=[]
def go(i):
    st,d=c.order(V,"buy","market",QTY)
    ok=st==201 and isinstance(d,dict)
    fills=d.get("fills",[]) if ok else []
    err=d if (not ok and isinstance(d,dict)) else {}
    res.append({"i":i,"status":st,
                "code":err.get("code"),"message":err.get("error") or err.get("message"),
                "executed_quantity":d.get("filled_quantity",0) if ok else 0,
                "executed_cost":round(sum(f["price"]*f["quantity"] for f in fills),4)})
th=[threading.Thread(target=go,args=(i,)) for i in range(N_ORDERS)]; [t.start() for t in th]; [t.join() for t in th]
final_balance=c.acct()["cashBalance"]
total_cost=round(sum(r["executed_cost"] for r in res),4)
executed=[r for r in res if r["executed_quantity"]>0]
# Recusas: 422 da validação de saldo (snapshot sem lock) e 422 da CHECK do banco (migration 000025) saem do
# motor pela mesma rejeição de negócio (ErrInsufficientBalance), então só o par (status, code) as agrupa;
# qualquer outro (status, code) aparece em separado.
refusals={}
for r in res:
    if r["executed_quantity"]==0:
        k=f'{r["status"]}/{r["code"]}'; refusals[k]=refusals.get(k,0)+1
chk("double-spend concorrente: custo executado total <= saldo inicial",total_cost<=initial_balance,True,(total_cost,initial_balance))
chk("double-spend concorrente: saldo final >=0",final_balance>=0,True,final_balance)
# Sem nenhuma compra aceita a disputa não foi exercitada (ex.: mercado fechado): não vale como prova.
chk("double-spend concorrente: alguma compra executou",len(executed)>0,True,res)
summary={"run":RUN,"user":c.name,"asset":"VALR3","orders":N_ORDERS,"order_quantity":QTY,
         "initial_balance":initial_balance,"best_ask":best_ask,
         "single_order_cost_at_best_ask":round(best_ask*QTY,4) if best_ask is not None else None,
         "executed_orders":len(executed),"refused_orders":N_ORDERS-len(executed),
         "refusals_by_status_code":refusals,"total_executed_cost":total_cost,
         "final_balance":final_balance,"balance_check":round(initial_balance-total_cost-final_balance,4),
         "orders_detail":sorted(res,key=lambda r:r["i"])}
json.dump(summary,open("neg_concorrencia.json","w"),indent=1,default=str)
print("--- concorrência: double spend ---")
print(f"saldo inicial={initial_balance} best_ask={best_ask} ordem de {QTY} ações ~ {summary['single_order_cost_at_best_ask']}")
print(f"executaram={len(executed)} recusadas={N_ORDERS-len(executed)} {refusals}")
print(f"custo executado total={total_cost} saldo final={final_balance}")
for r in summary["orders_detail"]: print("  ",r)
print(sum(1 for g,*_ in R if not g),"falhas de",len(R))
json.dump([r for r in R if not r[0]],open("neg_fail.json","w"),indent=1,default=str)
