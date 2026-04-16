import Head from 'next/head'
import { useState } from 'react'

const globalCSS = [
  '* { margin: 0; padding: 0; box-sizing: border-box; }',
  'html { scroll-behavior: smooth; }',
  "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; background: #fff; }",
  'nav { position: sticky; top: 0; z-index: 50; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border-bottom: 1px solid #e5e7eb; }',
  '.nav-inner { max-width: 1120px; margin: 0 auto; padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; }',
  '.nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }',
  '.nav-logo-icon { width: 36px; height: 36px; background: #185FA5; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }',
  '.nav-logo-text { font-size: 15px; font-weight: 700; color: #111; }',
  '.nav-logo-sub { font-size: 10px; color: #6b7280; font-weight: 400; }',
  '.nav-links { display: flex; align-items: center; gap: 28px; }',
  '.nav-links a { font-size: 13px; color: #374151; text-decoration: none; font-weight: 500; }',
  '.nav-links a:hover { color: #185FA5; }',
  '.nav-cta { display: flex; gap: 10px; }',
  '.btn-outline { padding: 7px 16px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; font-weight: 500; color: #374151; background: #fff; cursor: pointer; text-decoration: none; }',
  '.btn-outline:hover { border-color: #185FA5; color: #185FA5; }',
  '.btn-primary { padding: 7px 16px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; color: #fff; background: #185FA5; cursor: pointer; text-decoration: none; }',
  '.btn-primary:hover { background: #145089; }',
  '.nav-mobile-btn { display: none; background: none; border: none; cursor: pointer; padding: 4px; }',
  '.hero { background: linear-gradient(160deg, #f0f6ff 0%, #e8f2ff 40%, #f5f9ff 100%); padding: 100px 24px 80px; text-align: center; }',
  '.hero-badge { display: inline-flex; align-items: center; gap: 6px; background: #E6F1FB; color: #185FA5; border: 1px solid #b5d4f4; border-radius: 99px; padding: 5px 14px; font-size: 12px; font-weight: 600; margin-bottom: 24px; }',
  '.hero h1 { font-size: clamp(32px, 5vw, 54px); font-weight: 800; color: #0b1f3a; line-height: 1.15; max-width: 760px; margin: 0 auto 20px; letter-spacing: -0.5px; }',
  '.hero h1 span { color: #185FA5; }',
  '.hero p { font-size: clamp(15px, 2vw, 18px); color: #4b5563; max-width: 560px; margin: 0 auto 36px; line-height: 1.7; }',
  '.hero-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }',
  '.btn-hero-primary { padding: 14px 28px; background: #185FA5; color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; }',
  '.btn-hero-primary:hover { background: #145089; }',
  '.btn-hero-outline { padding: 14px 28px; background: #fff; color: #185FA5; border: 2px solid #185FA5; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; text-decoration: none; }',
  '.btn-hero-outline:hover { background: #f0f6ff; }',
  '.hero-note { margin-top: 16px; font-size: 12px; color: #9ca3af; }',
  '.section { max-width: 1120px; margin: 0 auto; padding: 80px 24px; }',
  '.section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #185FA5; margin-bottom: 12px; text-align: center; }',
  '.section-title { font-size: clamp(24px, 3.5vw, 38px); font-weight: 800; color: #0b1f3a; text-align: center; line-height: 1.2; max-width: 640px; margin: 0 auto 16px; letter-spacing: -0.3px; }',
  '.section-desc { font-size: 16px; color: #6b7280; text-align: center; max-width: 520px; margin: 0 auto 56px; line-height: 1.7; }',
  '.events-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }',
  '.event-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 24px; transition: box-shadow .2s, border-color .2s; }',
  '.event-card:hover { box-shadow: 0 8px 24px rgba(24,95,165,0.1); border-color: #b5d4f4; }',
  '.event-badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; background: #E6F1FB; color: #185FA5; margin-bottom: 12px; }',
  '.event-card h3 { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 8px; }',
  '.event-card p { font-size: 13px; color: #6b7280; line-height: 1.6; }',
  '.ai-section { background: linear-gradient(135deg, #0b1f3a 0%, #185FA5 100%); color: #fff; padding: 80px 24px; }',
  '.ai-inner { max-width: 1120px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }',
  '.ai-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #93c5fd; margin-bottom: 12px; }',
  '.ai-title { font-size: clamp(24px, 3.5vw, 38px); font-weight: 800; line-height: 1.2; margin-bottom: 20px; letter-spacing: -0.3px; }',
  '.ai-desc { font-size: 16px; color: #bfdbfe; line-height: 1.7; margin-bottom: 32px; }',
  '.ai-features { display: flex; flex-direction: column; gap: 14px; }',
  '.ai-feature { display: flex; align-items: flex-start; gap: 12px; }',
  '.ai-feature-icon { width: 32px; height: 32px; background: rgba(255,255,255,0.15); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }',
  '.ai-feature-text h4 { font-size: 14px; font-weight: 600; margin-bottom: 3px; }',
  '.ai-feature-text p { font-size: 13px; color: #bfdbfe; line-height: 1.5; }',
  '.ai-card { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 28px; }',
  '.ai-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }',
  '.ai-dot { width: 10px; height: 10px; border-radius: 50%; }',
  '.ai-doc { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; }',
  '.ai-doc-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #93c5fd; margin-bottom: 6px; }',
  '.ai-doc-row { display: flex; justify-content: space-between; font-size: 12px; color: rgba(255,255,255,0.7); margin-bottom: 3px; }',
  '.ai-doc-val { color: #fff; font-weight: 600; }',
  '.ai-status { display: flex; align-items: center; gap: 8px; background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3); border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #86efac; font-weight: 500; }',
  '.ai-status-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; }',
  '.features-bg { background: #f9fafb; padding: 80px 0; }',
  '.features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }',
  '.feature-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 28px; }',
  '.feature-icon { width: 44px; height: 44px; background: #E6F1FB; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }',
  '.feature-card h3 { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 8px; }',
  '.feature-card p { font-size: 13px; color: #6b7280; line-height: 1.65; }',
  '.steps-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 32px; }',
  '.step { text-align: center; }',
  '.step-num { width: 48px; height: 48px; background: #185FA5; color: #fff; border-radius: 50%; font-size: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }',
  '.step h3 { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 8px; }',
  '.step p { font-size: 13px; color: #6b7280; line-height: 1.65; }',
  '.pricing-bg { background: #f9fafb; padding: 80px 0; }',
  '.pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; max-width: 900px; margin: 0 auto; }',
  '.price-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px; }',
  '.price-card.featured { border-color: #185FA5; border-width: 2px; position: relative; }',
  '.price-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #185FA5; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 14px; border-radius: 99px; white-space: nowrap; }',
  '.price-plan { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 8px; }',
  '.price-amount { font-size: 36px; font-weight: 800; color: #111; margin-bottom: 4px; }',
  '.price-amount span { font-size: 14px; font-weight: 400; color: #6b7280; }',
  '.price-desc { font-size: 13px; color: #9ca3af; margin-bottom: 24px; line-height: 1.5; }',
  '.price-features { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px; }',
  '.price-features li { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: #374151; }',
  '.check { color: #22c55e; font-weight: 700; flex-shrink: 0; }',
  '.price-btn { width: 100%; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; display: block; text-align: center; border: none; }',
  '.price-btn-outline { background: #fff; color: #185FA5; border: 2px solid #185FA5; }',
  '.price-btn-outline:hover { background: #f0f6ff; }',
  '.price-btn-filled { background: #185FA5; color: #fff; }',
  '.price-btn-filled:hover { background: #145089; }',
  '.testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }',
  '.testimonial { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 28px; }',
  '.testimonial-stars { color: #f59e0b; font-size: 14px; margin-bottom: 12px; }',
  '.testimonial p { font-size: 14px; color: #374151; line-height: 1.7; margin-bottom: 16px; font-style: italic; }',
  '.testimonial-author { display: flex; align-items: center; gap: 12px; }',
  '.testimonial-avatar { width: 36px; height: 36px; background: #E6F1FB; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #185FA5; flex-shrink: 0; }',
  '.testimonial-name { font-size: 13px; font-weight: 600; color: #111; }',
  '.testimonial-role { font-size: 11px; color: #9ca3af; }',
  '.cta-bg { background: linear-gradient(135deg, #0b1f3a 0%, #185FA5 100%); padding: 80px 24px; text-align: center; }',
  '.cta-title { font-size: clamp(26px, 4vw, 44px); font-weight: 800; color: #fff; margin-bottom: 16px; max-width: 600px; margin-left: auto; margin-right: auto; letter-spacing: -0.3px; }',
  '.cta-desc { font-size: 16px; color: #bfdbfe; margin-bottom: 36px; max-width: 480px; margin-left: auto; margin-right: auto; line-height: 1.7; }',
  '.cta-btns { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }',
  '.btn-cta-white { padding: 14px 28px; background: #fff; color: #185FA5; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; text-decoration: none; }',
  '.btn-cta-white:hover { background: #f0f6ff; }',
  '.btn-cta-outline { padding: 14px 28px; background: transparent; color: #fff; border: 2px solid rgba(255,255,255,0.4); border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; text-decoration: none; }',
  '.btn-cta-outline:hover { border-color: #fff; }',
  '.cta-note { margin-top: 16px; font-size: 12px; color: rgba(255,255,255,0.5); }',
  'footer { background: #0b1f3a; padding: 48px 24px 32px; }',
  '.footer-inner { max-width: 1120px; margin: 0 auto; }',
  '.footer-top { display: flex; justify-content: space-between; gap: 40px; flex-wrap: wrap; margin-bottom: 40px; }',
  '.footer-brand p { font-size: 13px; color: #6b7280; line-height: 1.7; margin-top: 12px; max-width: 240px; }',
  '.footer-links h4 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 12px; }',
  '.footer-links ul { list-style: none; display: flex; flex-direction: column; gap: 8px; }',
  '.footer-links a { font-size: 13px; color: #6b7280; text-decoration: none; }',
  '.footer-links a:hover { color: #fff; }',
  '.footer-bottom { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }',
  '.footer-bottom p { font-size: 12px; color: #4b5563; }',
  '.footer-logo-text { font-size: 15px; font-weight: 700; color: #fff; }',
  '.footer-logo-sub { font-size: 10px; color: #6b7280; }',
  '.divider { border: none; border-top: 1px solid #e5e7eb; }',
  '.stats-bar { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 32px 24px; }',
  '.stats-inner { max-width: 1120px; margin: 0 auto; display: flex; justify-content: center; gap: 64px; flex-wrap: wrap; }',
  '.stat { text-align: center; }',
  '.stat-num { font-size: 32px; font-weight: 800; color: #185FA5; }',
  '.stat-label { font-size: 12px; color: #6b7280; margin-top: 3px; }',
  '@media (max-width: 768px) {',
  '  .nav-links, .nav-cta { display: none; }',
  '  .nav-mobile-btn { display: block; }',
  '  .ai-inner { grid-template-columns: 1fr; gap: 40px; }',
  '  .steps-grid { grid-template-columns: 1fr; }',
  '  .stats-inner { gap: 32px; }',
  '  .footer-top { flex-direction: column; }',
  '}',
].join('\n')

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <Head>
        <title>eSocial SST — Transmissão automática com IA</title>
        <meta name="description" content="Transmita os eventos SST do eSocial (S-2210, S-2220, S-2221, S-2240) com inteligência artificial. Leia PDF de LTCAT, PCMSO e ASO automaticamente. Trial gratuito de 14 dias." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="eSocial SST — Transmissão automática com IA" />
        <meta property="og:description" content="Transmita os eventos SST do eSocial com IA. Leia PDF de LTCAT, PCMSO e ASO automaticamente." />
        <meta property="og:type" content="website" />
        <style dangerouslySetInnerHTML={{ __html: globalCSS }} />
      </Head>

      {/* NAV */}
      <nav>
        <div className="nav-inner">
          <a href="#" className="nav-logo">
            <div className="nav-logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
                <polyline points="14,3 14,8 19,8"/>
              </svg>
            </div>
            <div>
              <div className="nav-logo-text">eSocial SST</div>
              <div className="nav-logo-sub">Transmissor inteligente</div>
            </div>
          </a>
          <div className="nav-links">
            <a href="#eventos">Eventos SST</a>
            <a href="#ia">IA &amp; Documentos</a>
            <a href="#funcionalidades">Funcionalidades</a>
            <a href="#precos">Preços</a>
          </div>
          <div className="nav-cta">
            <a href="/" className="btn-outline">Entrar</a>
            <a href="/cadastro" className="btn-primary">Testar grátis</a>
          </div>
          <button className="nav-mobile-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div style={{ background:'#fff', borderTop:'1px solid #e5e7eb', padding:'16px 24px', display:'flex', flexDirection:'column', gap:16 }}>
            <a href="#eventos" style={{ fontSize:14, color:'#374151', textDecoration:'none' }} onClick={() => setMenuOpen(false)}>Eventos SST</a>
            <a href="#ia" style={{ fontSize:14, color:'#374151', textDecoration:'none' }} onClick={() => setMenuOpen(false)}>IA &amp; Documentos</a>
            <a href="#funcionalidades" style={{ fontSize:14, color:'#374151', textDecoration:'none' }} onClick={() => setMenuOpen(false)}>Funcionalidades</a>
            <a href="#precos" style={{ fontSize:14, color:'#374151', textDecoration:'none' }} onClick={() => setMenuOpen(false)}>Preços</a>
            <div style={{ display:'flex', gap:10 }}>
              <a href="/" style={{ flex:1, textAlign:'center', textDecoration:'none', padding:'9px', fontSize:13, fontWeight:500, color:'#374151', border:'1px solid #d1d5db', borderRadius:8 }}>Entrar</a>
              <a href="/cadastro" style={{ flex:1, textAlign:'center', textDecoration:'none', padding:'9px', fontSize:13, fontWeight:600, color:'#fff', background:'#185FA5', borderRadius:8 }}>Testar grátis</a>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          Powered by Inteligência Artificial
        </div>
        <h1>
          Transmissão eSocial SST<br />
          <span>simples, rápida e com IA</span>
        </h1>
        <p>
          Envie os eventos S-2210, S-2220, S-2221 e S-2240 diretamente ao governo.
          Importe PDF de LTCAT, PCMSO e ASO — a IA extrai os dados automaticamente.
        </p>
        <div className="hero-btns">
          <a href="/cadastro" className="btn-hero-primary">
            Começar trial grátis
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9,18 15,12 9,6"/>
            </svg>
          </a>
          <a href="#ia" className="btn-hero-outline">Ver como funciona</a>
        </div>
        <p className="hero-note">14 dias grátis · Sem cartão de crédito · Cancele quando quiser</p>
      </section>

      {/* STATS */}
      <div className="stats-bar">
        <div className="stats-inner">
          <div className="stat"><div className="stat-num">4</div><div className="stat-label">Eventos SST suportados</div></div>
          <div className="stat"><div className="stat-num">3</div><div className="stat-label">Documentos lidos por IA</div></div>
          <div className="stat"><div className="stat-num">14</div><div className="stat-label">Dias grátis no trial</div></div>
          <div className="stat"><div className="stat-num">100%</div><div className="stat-label">Conforme normas eSocial</div></div>
        </div>
      </div>

      {/* EVENTOS SST */}
      <section id="eventos">
        <div className="section">
          <div className="section-label">Eventos SST</div>
          <h2 className="section-title">Todos os eventos de saúde e segurança do trabalho</h2>
          <p className="section-desc">Transmita cada obrigação SST diretamente ao eSocial, com validação automática antes do envio.</p>
          <div className="events-grid">
            <div className="event-card">
              <div className="event-badge">S-2210</div>
              <h3>Comunicação de Acidente de Trabalho</h3>
              <p>Registro e transmissão de CAT com todos os campos exigidos pela legislação. Notificação automática de prazos.</p>
            </div>
            <div className="event-card">
              <div className="event-badge">S-2220</div>
              <h3>Monitoramento de Saúde do Trabalhador</h3>
              <p>ASO completo com vínculo ao funcionário, tipo de exame, médico responsável e validade automática.</p>
            </div>
            <div className="event-card">
              <div className="event-badge">S-2221</div>
              <h3>Exame Toxicológico do Motorista</h3>
              <p>Exame toxicológico de longa janela para motoristas profissionais, conforme Lei 12.619/2012.</p>
            </div>
            <div className="event-card">
              <div className="event-badge">S-2240</div>
              <h3>Condições Ambientais do Trabalho</h3>
              <p>Agentes nocivos, EPIs, EPCs, LTCAT e fatores de risco registrados por função e ambiente.</p>
            </div>
          </div>
        </div>
      </section>

      <hr className="divider" />

      {/* AI SECTION */}
      <section id="ia" className="ai-section">
        <div className="ai-inner">
          <div>
            <div className="ai-label">Inteligência Artificial</div>
            <h2 className="ai-title">Importe um PDF.<br />A IA faz o resto.</h2>
            <p className="ai-desc">
              Envie o arquivo PDF do LTCAT, PCMSO ou ASO. Nosso sistema usa Claude (Anthropic) para ler o documento, identificar o tipo e preencher todos os campos automaticamente.
            </p>
            <div className="ai-features">
              <div className="ai-feature">
                <div className="ai-feature-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/>
                  </svg>
                </div>
                <div className="ai-feature-text">
                  <h4>LTCAT — Laudo Técnico</h4>
                  <p>Extrai agentes nocivos, intensidade, metodologia e conclusões do laudo.</p>
                </div>
              </div>
              <div className="ai-feature">
                <div className="ai-feature-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/>
                  </svg>
                </div>
                <div className="ai-feature-text">
                  <h4>PCMSO — Programa de Saúde</h4>
                  <p>Identifica médico coordenador, vigência, exames requeridos e cronograma.</p>
                </div>
              </div>
              <div className="ai-feature">
                <div className="ai-feature-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div className="ai-feature-text">
                  <h4>ASO — Atestado de Saúde</h4>
                  <p>Lê nome, CPF, função, médico, CRM, resultado e data do exame ocupacional.</p>
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="ai-card">
              <div className="ai-card-header">
                <div className="ai-dot" style={{ background:'#ef4444' }}></div>
                <div className="ai-dot" style={{ background:'#f59e0b' }}></div>
                <div className="ai-dot" style={{ background:'#22c55e' }}></div>
                <span style={{ marginLeft:8, fontSize:12, color:'rgba(255,255,255,0.4)' }}>IA extraindo dados do PDF...</span>
              </div>
              <div className="ai-doc">
                <div className="ai-doc-title">PCMSO — Extraído por IA</div>
                <div className="ai-doc-row"><span>Empresa:</span><span className="ai-doc-val">Metalúrgica Alfa Ltda</span></div>
                <div className="ai-doc-row"><span>Médico:</span><span className="ai-doc-val">Dr. Roberto Lima</span></div>
                <div className="ai-doc-row"><span>CRM:</span><span className="ai-doc-val">SP-42891</span></div>
                <div className="ai-doc-row"><span>Vigência:</span><span className="ai-doc-val">Jan/2025 — Dez/2025</span></div>
              </div>
              <div className="ai-doc">
                <div className="ai-doc-title">ASO — Extraído por IA</div>
                <div className="ai-doc-row"><span>Funcionário:</span><span className="ai-doc-val">João Silva Santos</span></div>
                <div className="ai-doc-row"><span>Tipo de exame:</span><span className="ai-doc-val">Periódico</span></div>
                <div className="ai-doc-row"><span>Resultado:</span><span className="ai-doc-val">Apto</span></div>
                <div className="ai-doc-row"><span>Próximo exame:</span><span className="ai-doc-val">15/03/2026</span></div>
              </div>
              <div className="ai-status">
                <div className="ai-status-dot"></div>
                Dados validados — prontos para transmitir ao eSocial
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FUNCIONALIDADES */}
      <section id="funcionalidades" className="features-bg">
        <div className="section" style={{ paddingTop:0 }}>
          <div className="section-label">Funcionalidades</div>
          <h2 className="section-title">Tudo que você precisa para cumprir o eSocial SST</h2>
          <p className="section-desc">Uma plataforma completa para médicos do trabalho, engenheiros de segurança e RH.</p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h3>Transmissão gov.br</h3>
              <p>Envio direto ao ambiente de produção do eSocial com certificado digital A1/A3. Retorno de recibo automático.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <h3>Multi-empresa</h3>
              <p>Gerencie várias empresas com um único login. Ideal para escritórios de SST e prestadores de serviço.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
              </div>
              <h3>Alertas de vencimento</h3>
              <p>Receba notificações por e-mail sobre ASOs próximos do vencimento. Nunca mais perca um prazo.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                </svg>
              </div>
              <h3>Painel administrativo</h3>
              <p>Visão completa do SaaS: clientes, planos, uso de IA, transmissões realizadas e status do sistema.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"/>
                  <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
                </svg>
              </div>
              <h3>Cadastro de funcionários</h3>
              <p>Base centralizada com CPF, função, CBO, setor e histórico de exames de toda a empresa.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2">
                  <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
                </svg>
              </div>
              <h3>Histórico de transmissões</h3>
              <p>Consulte todos os eventos enviados, recibos do eSocial, XML gerado e status de cada transmissão.</p>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section>
        <div className="section">
          <div className="section-label">Como funciona</div>
          <h2 className="section-title">Em 4 passos simples</h2>
          <p className="section-desc">Do cadastro à transmissão em minutos, sem necessidade de conhecimento técnico em XML.</p>
          <div className="steps-grid">
            <div className="step"><div className="step-num">1</div><h3>Crie sua conta</h3><p>Trial gratuito de 14 dias. Cadastre sua empresa e funcionários em minutos.</p></div>
            <div className="step"><div className="step-num">2</div><h3>Importe ou preencha</h3><p>Envie um PDF ou preencha os dados do evento SST diretamente no sistema.</p></div>
            <div className="step"><div className="step-num">3</div><h3>Valide com a IA</h3><p>A inteligência artificial verifica os dados e sugere correções antes do envio.</p></div>
            <div className="step"><div className="step-num">4</div><h3>Transmita ao eSocial</h3><p>Clique em transmitir. O sistema assina, envia ao gov.br e salva o recibo automaticamente.</p></div>
          </div>
        </div>
      </section>

      <hr className="divider" />

      {/* PRICING */}
      <section id="precos" className="pricing-bg">
        <div className="section" style={{ paddingTop:0 }}>
          <div className="section-label">Planos</div>
          <h2 className="section-title">Simples e transparente</h2>
          <p className="section-desc">Comece grátis e escolha o plano ideal para o tamanho da sua operação.</p>
          <div className="pricing-grid">
            <div className="price-card">
              <div className="price-plan">Starter</div>
              <div className="price-amount">R$ 97<span>/mês</span></div>
              <p className="price-desc">Para empresas com até 50 funcionários e 1 usuário.</p>
              <ul className="price-features">
                <li><span className="check">✓</span>Todos os eventos SST (S-2210 a S-2240)</li>
                <li><span className="check">✓</span>Leitura de PDF por IA (LTCAT, PCMSO, ASO)</li>
                <li><span className="check">✓</span>Transmissão direta ao gov.br</li>
                <li><span className="check">✓</span>Alertas de vencimento por e-mail</li>
                <li><span className="check">✓</span>Histórico completo de transmissões</li>
              </ul>
              <a href="/cadastro" className="price-btn price-btn-outline">Começar grátis</a>
            </div>
            <div className="price-card featured">
              <div className="price-badge">Mais popular</div>
              <div className="price-plan">Profissional</div>
              <div className="price-amount">R$ 197<span>/mês</span></div>
              <p className="price-desc">Para escritórios de SST com múltiplas empresas e equipes.</p>
              <ul className="price-features">
                <li><span className="check">✓</span>Tudo do Starter</li>
                <li><span className="check">✓</span>Multi-empresa ilimitado</li>
                <li><span className="check">✓</span>Até 5 usuários por empresa</li>
                <li><span className="check">✓</span>Convite de colaboradores</li>
                <li><span className="check">✓</span>Suporte prioritário</li>
                <li><span className="check">✓</span>Exportação de relatórios</li>
              </ul>
              <a href="/cadastro" className="price-btn price-btn-filled">Começar grátis</a>
            </div>
            <div className="price-card">
              <div className="price-plan">Dúvidas ou cotação?</div>
              <div className="price-amount" style={{ fontSize:24, lineHeight:1.2 }}>Fale<br/>conosco</div>
              <p className="price-desc">Entre em contato pelo canal de sua preferência. Respondemos rápido!</p>
              <ul className="price-features">
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" style={{flexShrink:0,marginTop:1}}>
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                  </svg>
                  <a href="tel:+5564992090277" style={{color:'#374151',textDecoration:'none'}}>(64) 99209-0277</a>
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" style={{flexShrink:0,marginTop:1}}>
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <a href="mailto:dseg.sst@gmail.com" style={{color:'#374151',textDecoration:'none'}}>dseg.sst@gmail.com</a>
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" style={{flexShrink:0,marginTop:1}}>
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                  <a href="https://instagram.com/dseg.sst" target="_blank" rel="noopener noreferrer" style={{color:'#374151',textDecoration:'none'}}>@dseg.sst</a>
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" style={{flexShrink:0,marginTop:1}}>
                    <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
                  </svg>
                  <a href="https://facebook.com/DsegConsultoria" target="_blank" rel="noopener noreferrer" style={{color:'#374151',textDecoration:'none'}}>Dseg Consultoria</a>
                </li>
              </ul>
              <a href="tel:+5564992090277" className="price-btn price-btn-outline">Ligar agora</a>
            </div>
          </div>
          <p style={{ textAlign:'center', marginTop:28, fontSize:13, color:'#9ca3af' }}>
            Todos os planos incluem 14 dias grátis · Sem contrato de fidelidade · Cancele quando quiser
          </p>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section>
        <div className="section">
          <div className="section-label">Depoimentos</div>
          <h2 className="section-title">Quem já usa o eSocial SST</h2>
          <p className="section-desc">Profissionais de SST em todo o Brasil economizando horas por semana.</p>
          <div className="testimonials-grid">
            <div className="testimonial">
              <div className="testimonial-stars">★★★★★</div>
              <p>"Antes eu gastava horas preenchendo XML manualmente. Com o eSocial SST importo o PDF do ASO e em segundos está tudo pronto para transmitir. Incrível."</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">MC</div>
                <div><div className="testimonial-name">Márcia C.</div><div className="testimonial-role">Médica do Trabalho · São Paulo</div></div>
              </div>
            </div>
            <div className="testimonial">
              <div className="testimonial-stars">★★★★★</div>
              <p>"Gerencio 12 empresas clientes aqui. O multi-empresa é perfeito, cada uma isolada mas eu acesso tudo com um login só. O suporte também é excelente."</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">RF</div>
                <div><div className="testimonial-name">Ricardo F.</div><div className="testimonial-role">Engenheiro de Segurança · Curitiba</div></div>
              </div>
            </div>
            <div className="testimonial">
              <div className="testimonial-stars">★★★★★</div>
              <p>"O alerta de vencimento de ASO salvou minha empresa de uma autuação. O sistema mandou o e-mail 30 dias antes e conseguimos regularizar a tempo."</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">PS</div>
                <div><div className="testimonial-name">Patricia S.</div><div className="testimonial-role">Analista de RH · Belo Horizonte</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-bg">
        <h2 className="cta-title">Comece seu trial grátis hoje</h2>
        <p className="cta-desc">14 dias para explorar todas as funcionalidades. Sem cartão de crédito, sem compromisso.</p>
        <div className="cta-btns">
          <a href="/cadastro" className="btn-cta-white">Criar conta grátis</a>
          <a href="/" className="btn-cta-outline">Já tenho conta — entrar</a>
        </div>
        <p className="cta-note">Suporte por e-mail em até 24h · Dados hospedados no Brasil</p>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:36, height:36, background:'#185FA5', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                    <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
                    <polyline points="14,3 14,8 19,8"/>
                  </svg>
                </div>
                <div>
                  <div className="footer-logo-text">eSocial SST</div>
                  <div className="footer-logo-sub">Transmissor inteligente</div>
                </div>
              </div>
              <p>Plataforma SaaS para transmissão de eventos SST ao eSocial com inteligência artificial.</p>
            </div>
            <div className="footer-links">
              <h4>Produto</h4>
              <ul>
                <li><a href="#eventos">Eventos SST</a></li>
                <li><a href="#ia">IA &amp; Documentos</a></li>
                <li><a href="#funcionalidades">Funcionalidades</a></li>
                <li><a href="#precos">Preços</a></li>
              </ul>
            </div>
            <div className="footer-links">
              <h4>Conta</h4>
              <ul>
                <li><a href="/">Entrar</a></li>
                <li><a href="/cadastro">Criar conta</a></li>
                <li><a href="/dashboard">Dashboard</a></li>
              </ul>
            </div>
            <div className="footer-links">
              <h4>Contato</h4>
              <ul>
                <li><a href="tel:+5564992090277">(64) 99209-0277</a></li>
                <li><a href="mailto:dseg.sst@gmail.com">dseg.sst@gmail.com</a></li>
                <li><a href="https://instagram.com/dseg.sst" target="_blank" rel="noopener noreferrer">Instagram</a></li>
                <li><a href="https://facebook.com/DsegConsultoria" target="_blank" rel="noopener noreferrer">Facebook</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p suppressHydrationWarning>© {new Date().getFullYear()} eSocial SST — Dseg Consultoria. Todos os direitos reservados.</p>
            <p>Desenvolvido no Brasil 🇧🇷</p>
          </div>
        </div>
      </footer>
    </>
  )
}
