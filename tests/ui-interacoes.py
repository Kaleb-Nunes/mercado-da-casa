"""Smoke test of Elida UI with real Chromium clicks. Isolated local HTTP only;
no real Firebase calls, credentials, cloud changes or health data."""
import os
import sys
import threading
import traceback
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/"qa-evidencias"
OUT.mkdir(exist_ok=True)
HTTP=ThreadingHTTPServer(("127.0.0.1",0), lambda *a,**kw: SimpleHTTPRequestHandler(*a,directory=str(ROOT),**kw))
threading.Thread(target=HTTP.serve_forever,daemon=True).start()
BASE=os.environ.get("ELIDA_QA_BASE",f"http://127.0.0.1:{HTTP.server_port}/")
REQUIRE_ADMIN=os.environ.get("ELIDA_QA_REQUIRE_ADMIN","1")=="1"
results=[]

def check(pg,name,fn):
    try:
        fn(pg)
        assert pg.locator("#view-inicio").count()==1
        results.append((name,True,""))
        print("OK",name,flush=True)
    except Exception as e:
        print("FALHA",name,str(e)[:350],flush=True)
        results.append((name,False,str(e)[:600]))
        pg.screenshot(path=str(OUT / ("erro-"+str(len(results))+".png")),full_page=False)
    finally:
        try:
            pg.close()
        except Exception:pass

def visible_click(pg,sel):
    obj=pg.locator(sel+":visible").first
    obj.click(timeout=6000)

def nav(pg,view):
    visible_click(pg,'[data-act="nav"][data-view="'+view+'"]')
    pg.locator("#view-"+view).wait_for(state="visible",timeout=5000)

def modal(pg):
    assert pg.locator("#sheet.on").is_visible()
def close(pg):
    visible_click(pg,'#sheet button.sh-close[data-act="fechar"]')
    pg.locator("#sheet.on").wait_for(state="hidden",timeout=3000)

def home(pg):
    pg.locator("#view-inicio").wait_for(state="visible")
    assert pg.locator("#elida-conta-botao").is_visible()

def prices(pg):
    nav(pg,"precos")
    visible_click(pg,'[data-act="filtro"]')
    visible_click(pg,'[data-act="item"]')
    modal(pg);close(pg)
    visible_click(pg,'[data-act="novo-item"]')
    modal(pg);close(pg)

def shopping(pg):
    nav(pg,"lista")
    if pg.locator('[data-act="basico"]:visible').count():
        visible_click(pg,'[data-act="basico"]')
    nav(pg,"precos")
    visible_click(pg,'[data-act="item"]')
    modal(pg);close(pg)

def budget(pg):
    visible_click(pg,'[data-act="orcamento"]')
    modal(pg)
    pg.locator("#f-orc").fill("250,00")
    visible_click(pg,'[data-act="salvar-orc"]')
    pg.locator("#sheet.on").wait_for(state="hidden")
    assert "250" in pg.locator("#view-inicio").inner_text()

def expenses(pg):
    visible_click(pg,'[data-act="novo-gasto"]')
    modal(pg)
    pg.locator("#f-valor").fill("15,00")
    visible_click(pg,'[data-act="salvar-gasto"]')
    pg.locator("#sheet.on").wait_for(state="hidden")

def diet(pg):
    nav(pg,"rotulo")
    assert pg.locator("#view-rotulo").is_visible()
    nav(pg,"perfis")
    visible_click(pg,'[data-act="novo-perfil"]')
    modal(pg)
    pg.locator("#f-pa").fill("Perfil de teste")
    close(pg)

def labels(pg):
    nav(pg,"rotulo")
    nav(pg,"rotulos")
    visible_click(pg,'[data-act="rotulo-digitado"]')
    modal(pg);close(pg)
    visible_click(pg,'[data-act="rotulo-foto"]')
    modal(pg);close(pg)

def backup(pg):
    visible_click(pg,'[data-act="backup"]')
    modal(pg)
    assert pg.locator("#f-senha-backup").is_visible()
    close(pg)
    visible_click(pg,'[data-act="restaurar"]')
    modal(pg)
    assert pg.locator("#f-senha-restaurar").count()==1
    close(pg)

def account(pg):
    pg.locator("#elida-conta-botao").click()
    pg.locator("#elida-conta-painel").wait_for(state="visible")
    assert pg.locator('[data-elida-action="google"]').count()==1
    assert pg.locator('[data-elida-action="cadastro"]').count()==1
    if REQUIRE_ADMIN:
        assert pg.locator('[data-elida-action="solicitar"]').count()==1
        assert pg.locator('[data-elida-action="lista"]').count()==1
        assert pg.locator('[data-elida-permissao]').count()==1
        # Without App Check, no privileged approval button is clickable.
        assert pg.locator('[data-elida-action="lista"]').is_hidden()
    visible_click(pg,'#elida-conta-painel [data-elida-action="fechar"]')
    pg.locator("#elida-conta-painel").wait_for(state="hidden")

try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        for width in (390,375):
            context=browser.new_context(viewport={"width":width,"height":844},device_scale_factor=1,
                                        is_mobile=True,has_touch=True,locale="pt-BR")
            for name,fn in [("Inicialização",home),("Preços, filtros e edição",prices),
                            ("Lista de compras",shopping),("Orçamento mensal",budget),
                            ("Registro de gasto",expenses),("Dieta e perfis",diet),
                            ("Rótulos digitado e câmera",labels),("Backup e restauração",backup),
                            ("Conta e formulário administrativo",account)]:
                pg=context.new_page()
                errors=[]
                pg.on("pageerror",lambda err:errors.append(str(err)))
                try:
                    pg.goto(BASE,wait_until="domcontentloaded",timeout=18000)
                    pg.locator("#view-inicio").wait_for(state="visible",timeout=10000)
                    def wrapped(page):
                        fn(page)
                        assert not errors,"Erros JS: "+repr(errors[:3])
                    check(pg,str(width)+"px "+name,wrapped)
                except Exception as exc:
                    results.append((str(width)+"px "+name,False,str(exc)))
                    print("FALHA ao carregar",width,name,str(exc)[:300],flush=True)
                    pg.screenshot(path=str(OUT/("erro-"+str(width)+"-"+str(len(results))+".png")))
                    pg.close()
            context.close()
        browser.close()
finally:
    HTTP.shutdown()
passe=sum(1 for _,ok,_ in results if ok)
print("RESULTADO UI em "+BASE+": "+str(passe)+"/"+str(len(results)),flush=True)
if passe!=len(results):
    for name,ok,detail in results:
        if not ok:print("FALHA:",name,detail,flush=True)
    sys.exit(1)
