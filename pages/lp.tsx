import Head from 'next/head'
import { useRouter } from 'next/router'

export default function LP() {
  const router = useRouter()
  const cta = () => router.push('/cadastro')

  return (
    <>
      <Head>
        <title>Transmita SST para o eSocial em 8 minutos — Teste grátis 14 dias</title>
        <meta name="description" content="IA que lê seu ASO, LTCAT e PCMSO e transmite automaticamente para o eSocial. Sem instalar nada. Trial grátis de 14 dias, sem cartão." />
        <meta name="robots" content="noindex" />
      </Head>

      <style dangerouslySetInnerHTML={{ __html: `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #070d1a; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .lp-wrap { max-width: 720px; margin: 0 auto; padding: 0 20px; }

        .hero { padding: 64px 0 48px; text-align: center; }
        .badge { display: inline-block; background: rgba(24,95,165,.25); border: 1px solid rgba(24,95,165,.5); color: #60a5fa; font-size: 12px; font-weight: 600; padding: 5px 14px; border-radius: 100px; margin-bottom: 24px; letter-spacing: .04em; }
        .hero h1 { font-size: clamp(28px, 5vw, 46px); font-weight: 800; line-height: 1.15; letter-spacing: -1px; margin-bottom: 18px; }
        .hero h1 span { background: linear-gradient(135deg, #60a5fa, #185FA5); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .hero p { font-size: clamp(15px, 2.5vw, 18px); color: #94a3b8; line-height: 1.7; margin-bottom: 32px; max-width: 560px; margin-left: auto; margin-right: auto; }
        .btn-main { display: inline-block; background: #185FA5; color: #fff; font-size: 16px; font-weight: 700; padding: 16px 36px; border-radius: 10px; border: none; cursor: pointer; text-decoration: none; transition: background .2s; }
        .btn-main:hover { background: #1a6fbf; }
        .trust { margin-top: 14px; font-size: 12px; color: #64748b; }
        .trust span { margin: 0 8px; }

        .section { padding: 48px 0; }
        .section-title { font-size: 11px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: .1em; text-align: center; margin-bottom: 12px; }
        .section-h2 { font-size: clamp(22px, 4vw, 30px); font-weight: 800; text-align: center; margin-bottom: 40px; letter-spacing: -.5px; }

        .pain { background: rgba(14,26,45,.6); border: 1px solid rgba(59,130,246,.15); border-radius: 16px; padding: 28px 32px; margin-bottom: 48px; }
        .pain-title { font-size: 13px; font-weight: 700; color: #94a3b8; margin-bottom: 16px; }
        .pain-list { list-style: none; }
        .pain-list li { display: flex; align-items: center; gap: 10px; font-size: 15px; color: #cbd5e1; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
        .pain-list li:last-child { border-bottom: none; }
        .pain-x { color: #f87171; font-size: 18px; font-weight: 700; flex-shrink: 0; }

        .benefits { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .benefit-card { background: rgba(14,26,45,.7); border: 1px solid rgba(59,130,246,.15); border-radius: 14px; padding: 24px 20px; }
        .benefit-icon { width: 40px; height: 40px; background: rgba(24,95,165,.3); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
        .benefit-card h3 { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
        .benefit-card p { font-size: 13px; color: #94a3b8; line-height: 1.6; }

        .steps { counter-reset: step; }
        .step { display: flex; gap: 20px; align-items: flex-start; padding: 20px 0; border-bottom: 1px solid rgba(255,255,255,.06); }
        .step:last-child { border-bottom: none; }
        .step-num { width: 36px; height: 36px; background: #185FA5; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; flex-shrink: 0; }
        .step-body h3 { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
        .step-body p { font-size: 13px; color: #94a3b8; line-height: 1.6; }

        .faq { display: flex; flex-direction: column; gap: 12px; }
        .faq-item { background: rgba(14,26,45,.7); border: 1px solid rgba(59,130,246,.12); border-radius: 12px; padding: 18px 20px; }
        .faq-item h3 { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
        .faq-item p { font-size: 13px; color: #94a3b8; line-height: 1.6; }

        .cta-bottom { text-align: center; padding: 56px 0 64px; }
        .cta-bottom h2 { font-size: clamp(22px, 4vw, 32px); font-weight: 800; margin-bottom: 12px; letter-spacing: -.5px; }
        .cta-bottom p { font-size: 15px; color: #94a3b8; margin-bottom: 28px; }

        .sticky-bar { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(7,13,26,.95); backdrop-filter: blur(12px); border-top: 1px solid rgba(59,130,246,.2); padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; z-index: 100; }
        .sticky-text { font-size: 13px; color: #94a3b8; }
        .sticky-text strong { color: #f1f5f9; }

        .lp-footer { text-align: center; padding: 20px 0 80px; font-size: 11px; color: #475569; border-top: 1px solid rgba(255,255,255,.06); }
        .lp-footer a { color: #64748b; text-decoration: none; }

        @media (max-width: 600px) {
          .hero { padding: 48px 0 36px; }
          .pain { padding: 20px; }
          .sticky-text { display: none; }
        }
      ` }} />

      <div className="lp-wrap">

        {/* ── HERO ── */}
        <div className="hero">
          <div className="badge">eSocial SST · Transmissão automática com IA</div>
          <h1>Transmita ASO, CAT e PCMSO<br />para o eSocial <span>em 8 minutos</span></h1>
          <p>Nossa IA lê o PDF, extrai os dados e transmite automaticamente para a Receita Federal. Sem digitar nada. Sem instalar programa.</p>
          <button className="btn-main" onClick={cta}>
            Criar conta grátis — 14 dias de trial
          </button>
          <div className="trust">
            <span>✓ Sem cartão de crédito</span>
            <span>✓ Cancele quando quiser</span>
            <span>✓ 100% online</span>
          </div>
        </div>

        {/* ── DOR ── */}
        <div className="pain">
          <div className="pain-title">O que acontece sem automação:</div>
          <ul className="pain-list">
            <li><span className="pain-x">✕</span> Digitar dados do ASO manualmente no eSocial — campo por campo</li>
            <li><span className="pain-x">✕</span> Esquecer o prazo do S-2220 e receber notificação da Receita</li>
            <li><span className="pain-x">✕</span> Multa de até R$&nbsp;1.812 por evento transmitido com atraso</li>
            <li><span className="pain-x">✕</span> Equipe de RH desperdiçando horas em tarefas repetitivas</li>
          </ul>
        </div>

        {/* ── BENEFÍCIOS ── */}
        <div className="section">
          <div className="section-title">Como funciona</div>
          <div className="section-h2">Tudo que você precisa em uma plataforma</div>
          <div className="benefits">
            <div className="benefit-card">
              <div className="benefit-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                  <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <h3>IA lê qualquer PDF</h3>
              <p>Sobe o documento, a IA extrai nome, CPF, CID, datas e médico responsável automaticamente.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <h3>Transmissão em 1 clique</h3>
              <p>XML gerado e enviado direto ao eSocial da Receita Federal. Protocolo e recibo automáticos.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
              </div>
              <h3>Alertas de vencimento</h3>
              <p>Receba e-mails automáticos antes dos prazos dos exames dos seus funcionários.</p>
            </div>
          </div>
        </div>

        {/* ── PASSO A PASSO ── */}
        <div className="section">
          <div className="section-title">Em 3 passos</div>
          <div className="section-h2">Como você vai usar no dia a dia</div>
          <div className="steps">
            <div className="step">
              <div className="step-num">1</div>
              <div className="step-body">
                <h3>Importe o documento</h3>
                <p>Faça upload do PDF do ASO, LTCAT, PCMSO ou CAT diretamente na plataforma.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <div className="step-body">
                <h3>A IA extrai os dados</h3>
                <p>Em segundos, todos os campos são preenchidos automaticamente. Você revisa e confirma.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <div className="step-body">
                <h3>Transmita para o eSocial</h3>
                <p>Clique em transmitir. O XML é gerado, assinado e enviado. Recibo em mãos na hora.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="section">
          <div className="section-title">Dúvidas frequentes</div>
          <div className="section-h2">Perguntas que todo mundo faz</div>
          <div className="faq">
            <div className="faq-item">
              <h3>Funciona para qualquer tamanho de empresa?</h3>
              <p>Sim. Do MEI com empregado ao grupo empresarial com múltiplos CNPJs. Você gerencia todas as empresas em uma única conta.</p>
            </div>
            <div className="faq-item">
              <h3>Precisa instalar algum programa ou certificado digital?</h3>
              <p>Não. A plataforma é 100% online. Você acessa pelo navegador. O certificado digital da empresa fica armazenado com segurança na nuvem.</p>
            </div>
            <div className="faq-item">
              <h3>O que acontece depois dos 14 dias de trial?</h3>
              <p>Você escolhe um plano a partir de R$&nbsp;167/mês ou cancela sem custo. Não existe cobrança automática no trial.</p>
            </div>
            <div className="faq-item">
              <h3>Quais eventos SST a plataforma transmite?</h3>
              <p>S-2210 (CAT), S-2220 (ASO/Monitoramento), S-2221 (Toxicológico) e S-2240 (Condições Ambientais). Cobre todas as obrigações SST.</p>
            </div>
          </div>
        </div>

        {/* ── CTA FINAL ── */}
        <div className="cta-bottom">
          <h2>Comece agora, grátis por 14 dias</h2>
          <p>Sem cartão de crédito. Sem compromisso. Cancele quando quiser.</p>
          <button className="btn-main" onClick={cta} style={{ fontSize: 17, padding: '18px 44px' }}>
            Criar conta grátis →
          </button>
        </div>

        {/* ── FOOTER ── */}
        <div className="lp-footer">
          © {new Date().getFullYear()} eSocial SST Transmissor · DSEG Consultoria ·{' '}
          <a href="mailto:contato@dsegconsultoria.com.br">contato@dsegconsultoria.com.br</a>
        </div>

      </div>

      {/* ── STICKY BAR MOBILE ── */}
      <div className="sticky-bar">
        <div className="sticky-text">
          <strong>14 dias grátis</strong> · sem cartão de crédito
        </div>
        <button className="btn-main" onClick={cta} style={{ fontSize: 13, padding: '10px 20px', whiteSpace: 'nowrap' }}>
          Começar agora →
        </button>
      </div>
    </>
  )
}
