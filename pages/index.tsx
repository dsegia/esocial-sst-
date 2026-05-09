import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'

// ─── CSS ─────────────────────────────────────────────────────────────────────
const globalCSS = [
  '* { margin:0; padding:0; box-sizing:border-box; }',
  'html { scroll-behavior:smooth; }',
  "body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#f1f5f9; background:#070d1a; }",

  // KEYFRAMES
  '@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }',
  '@keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(.85)} }',
  '@keyframes glow-ring { 0%,100%{box-shadow:0 0 0 0 rgba(24,95,165,.5)} 50%{box-shadow:0 0 0 8px rgba(24,95,165,0)} }',
  '@keyframes fade-up { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }',
  '@keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }',
  '@keyframes spin-slow { to{transform:rotate(360deg)} }',
  '@keyframes slide-in { from{opacity:0;transform:translateX(32px)} to{opacity:1;transform:translateX(0)} }',
  '@keyframes typing { 0%,100%{opacity:1} 50%{opacity:0} }',
  '@keyframes bar-grow { from{width:0} to{width:var(--w)} }',

  // NAV
  'nav { position:sticky; top:0; z-index:50; background:rgba(7,13,26,.85); backdrop-filter:blur(12px); border-bottom:1px solid rgba(24,95,165,.25); }',
  '.nav-inner { max-width:1200px; margin:0 auto; padding:0 24px; height:64px; display:flex; align-items:center; justify-content:space-between; }',
  '.nav-logo { display:flex; align-items:center; gap:10px; text-decoration:none; }',
  '.nav-logo-icon { width:38px; height:38px; background:linear-gradient(135deg,#185FA5,#3b82f6); border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 0 16px rgba(59,130,246,.35); }',
  '.nav-logo-text { font-size:16px; font-weight:800; color:#f1f5f9; letter-spacing:-.3px; }',
  '.nav-logo-sub { font-size:10px; color:#64748b; font-weight:400; }',
  '.nav-links { display:flex; align-items:center; gap:28px; }',
  '.nav-links a { font-size:13px; color:#94a3b8; text-decoration:none; font-weight:500; transition:color .15s; }',
  '.nav-links a:hover { color:#e2e8f0; }',
  '.nav-cta { display:flex; gap:10px; }',
  '.btn-ghost { padding:7px 16px; border:1px solid rgba(148,163,184,.25); border-radius:8px; font-size:13px; font-weight:500; color:#94a3b8; background:transparent; cursor:pointer; text-decoration:none; transition:border-color .15s,color .15s; }',
  '.btn-ghost:hover { border-color:#185FA5; color:#e2e8f0; }',
  '.btn-nav-cta { padding:8px 18px; border:none; border-radius:8px; font-size:13px; font-weight:600; color:#fff; background:linear-gradient(135deg,#185FA5,#3b82f6); cursor:pointer; text-decoration:none; box-shadow:0 0 14px rgba(59,130,246,.3); transition:box-shadow .2s,transform .1s; }',
  '.btn-nav-cta:hover { box-shadow:0 0 22px rgba(59,130,246,.5); transform:translateY(-1px); }',
  '.nav-mobile-btn { display:none; background:none; border:none; cursor:pointer; padding:4px; }',

  // HERO
  '.hero { min-height:100vh; display:flex; align-items:center; padding:80px 24px 60px; background:radial-gradient(ellipse 80% 60% at 50% -10%,rgba(24,95,165,.35) 0%,transparent 70%),#070d1a; overflow:hidden; position:relative; }',
  '.hero::before { content:""; position:absolute; inset:0; background:url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h1v60H0zm60 0h1v60H60zM0 0v1h60V0zm0 60v1h60V60z\' fill=\'rgba(24,95,165,0.04)\' fill-rule=\'evenodd\'/%3E%3C/svg%3E"); opacity:.6; }',
  '.hero-inner { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; gap:64px; align-items:center; position:relative; z-index:1; }',
  '.hero-badge { display:inline-flex; align-items:center; gap:8px; background:rgba(24,95,165,.15); color:#93c5fd; border:1px solid rgba(59,130,246,.3); border-radius:99px; padding:6px 16px; font-size:12px; font-weight:600; margin-bottom:24px; animation:fade-up .6s ease both; }',
  '.badge-dot { width:7px; height:7px; background:#22c55e; border-radius:50%; animation:pulse-dot 1.5s infinite; }',
  '.hero h1 { font-size:clamp(36px,4.5vw,58px); font-weight:900; line-height:1.1; margin-bottom:20px; letter-spacing:-1px; animation:fade-up .6s ease .1s both; }',
  '.hero h1 .grad { background:linear-gradient(135deg,#60a5fa,#3b82f6,#185FA5); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }',
  '.hero-sub { font-size:clamp(15px,1.8vw,18px); color:#94a3b8; line-height:1.75; margin-bottom:36px; max-width:480px; animation:fade-up .6s ease .2s both; }',
  '.hero-btns { display:flex; gap:12px; flex-wrap:wrap; animation:fade-up .6s ease .3s both; }',
  '.btn-cta-main { padding:15px 30px; background:linear-gradient(135deg,#185FA5,#3b82f6); color:#fff; border:none; border-radius:10px; font-size:15px; font-weight:700; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 24px rgba(59,130,246,.35); transition:transform .15s,box-shadow .15s; }',
  '.btn-cta-main:hover { transform:translateY(-2px); box-shadow:0 8px 32px rgba(59,130,246,.5); }',
  '.btn-cta-sec { padding:15px 28px; background:rgba(255,255,255,.05); color:#e2e8f0; border:1px solid rgba(255,255,255,.12); border-radius:10px; font-size:15px; font-weight:600; cursor:pointer; text-decoration:none; transition:background .15s,border-color .15s; }',
  '.btn-cta-sec:hover { background:rgba(255,255,255,.1); border-color:rgba(255,255,255,.25); }',
  '.hero-note { margin-top:14px; font-size:12px; color:#475569; animation:fade-up .6s ease .4s both; }',
  '.hero-note span { color:#64748b; }',

  // MOCKUP
  '.mockup-wrap { animation:slide-in .8s ease .2s both; }',
  '.mockup { background:rgba(14,26,45,.8); border:1px solid rgba(24,95,165,.3); border-radius:16px; overflow:hidden; box-shadow:0 20px 80px rgba(0,0,0,.6),0 0 40px rgba(24,95,165,.15); }',
  '.mockup-bar { background:rgba(7,13,26,.9); padding:10px 16px; display:flex; align-items:center; gap:8px; border-bottom:1px solid rgba(24,95,165,.2); }',
  '.mock-dot { width:10px; height:10px; border-radius:50%; }',
  '.mockup-title { font-size:11px; color:#475569; margin-left:auto; font-family:monospace; }',
  '.mockup-body { padding:16px; }',
  '.mock-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px; }',
  '.mock-stat-card { background:rgba(24,95,165,.1); border:1px solid rgba(24,95,165,.2); border-radius:8px; padding:10px; text-align:center; }',
  '.mock-stat-num { font-size:20px; font-weight:800; color:#60a5fa; }',
  '.mock-stat-label { font-size:9px; color:#64748b; margin-top:2px; text-transform:uppercase; letter-spacing:.5px; }',
  '.mock-table-header { display:grid; grid-template-columns:1.5fr 1fr 1fr; gap:6px; padding:6px 8px; font-size:9px; color:#475569; text-transform:uppercase; letter-spacing:.5px; border-bottom:1px solid rgba(255,255,255,.06); margin-bottom:6px; }',
  '.mock-row { display:grid; grid-template-columns:1.5fr 1fr 1fr; gap:6px; padding:7px 8px; border-radius:6px; font-size:11px; align-items:center; transition:background .15s; }',
  '.mock-row:hover { background:rgba(24,95,165,.1); }',
  '.mock-nome { color:#e2e8f0; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
  '.mock-evento { color:#94a3b8; font-size:10px; }',
  '.mock-badge { padding:2px 8px; border-radius:99px; font-size:9px; font-weight:700; text-align:center; white-space:nowrap; }',
  '.mock-badge-ok { background:rgba(34,197,94,.15); color:#4ade80; border:1px solid rgba(34,197,94,.25); }',
  '.mock-badge-pend { background:rgba(239,159,39,.15); color:#fbbf24; border:1px solid rgba(239,159,39,.25); }',
  '.mock-badge-new { background:rgba(59,130,246,.15); color:#93c5fd; border:1px solid rgba(59,130,246,.25); }',
  '.mock-ai-bar { background:rgba(24,95,165,.08); border:1px solid rgba(59,130,246,.2); border-radius:8px; padding:8px 12px; margin-top:10px; display:flex; align-items:center; gap:8px; font-size:10px; color:#93c5fd; }',
  '.mock-ai-dot { width:6px; height:6px; background:#22c55e; border-radius:50%; animation:pulse-dot 1.5s infinite; flex-shrink:0; }',

  // STATS SECTION
  '.stats-section { background:rgba(14,26,45,.6); border-top:1px solid rgba(24,95,165,.2); border-bottom:1px solid rgba(24,95,165,.2); padding:36px 24px; }',
  '.stats-inner { max-width:1200px; margin:0 auto; display:flex; justify-content:center; gap:0; flex-wrap:wrap; }',
  '.stat-item { text-align:center; padding:0 48px; position:relative; }',
  '.stat-item:not(:last-child)::after { content:""; position:absolute; right:0; top:10%; height:80%; width:1px; background:rgba(24,95,165,.25); }',
  '.stat-num { font-size:38px; font-weight:900; background:linear-gradient(135deg,#60a5fa,#3b82f6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; letter-spacing:-1px; }',
  '.stat-label { font-size:12px; color:#64748b; margin-top:4px; font-weight:500; }',

  // SECTION common
  '.section-wrap { max-width:1200px; margin:0 auto; padding:80px 24px; }',
  '.section-tag { display:inline-block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:2px; color:#3b82f6; background:rgba(59,130,246,.1); border:1px solid rgba(59,130,246,.2); border-radius:99px; padding:4px 14px; margin-bottom:14px; }',
  '.section-h2 { font-size:clamp(26px,3.5vw,42px); font-weight:900; color:#f1f5f9; line-height:1.15; max-width:640px; margin:0 auto 14px; text-align:center; letter-spacing:-.5px; }',
  '.section-h2 .grad { background:linear-gradient(135deg,#60a5fa,#3b82f6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }',
  '.section-desc { font-size:16px; color:#64748b; text-align:center; max-width:520px; margin:0 auto 56px; line-height:1.75; }',

  // EVENTS
  '.events-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px; }',
  '.event-card { background:rgba(14,26,45,.7); border:1px solid rgba(24,95,165,.2); border-radius:14px; padding:26px; transition:border-color .2s,transform .2s,box-shadow .2s; cursor:default; }',
  '.event-card:hover { border-color:rgba(59,130,246,.5); transform:translateY(-4px); box-shadow:0 16px 40px rgba(0,0,0,.3),0 0 24px rgba(24,95,165,.15); }',
  '.event-code { display:inline-block; padding:4px 12px; border-radius:8px; font-size:12px; font-weight:800; background:linear-gradient(135deg,#185FA5,#3b82f6); color:#fff; margin-bottom:14px; font-family:monospace; letter-spacing:.5px; box-shadow:0 4px 12px rgba(59,130,246,.25); }',
  '.event-card h3 { font-size:15px; font-weight:700; color:#e2e8f0; margin-bottom:8px; }',
  '.event-card p { font-size:13px; color:#64748b; line-height:1.65; }',

  // AI SECTION
  '.ai-bg { background:linear-gradient(160deg,#0a1628 0%,#0d1f3c 100%); padding:80px 0; border-top:1px solid rgba(24,95,165,.2); border-bottom:1px solid rgba(24,95,165,.2); overflow:hidden; position:relative; }',
  '.ai-bg::after { content:""; position:absolute; top:-40%; right:-10%; width:500px; height:500px; background:radial-gradient(circle,rgba(59,130,246,.12) 0%,transparent 70%); pointer-events:none; }',
  '.ai-inner { max-width:1200px; margin:0 auto; padding:0 24px; display:grid; grid-template-columns:1fr 1fr; gap:72px; align-items:center; position:relative; z-index:1; }',
  '.ai-tag { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:2px; color:#3b82f6; margin-bottom:14px; }',
  '.ai-h2 { font-size:clamp(28px,3.5vw,44px); font-weight:900; line-height:1.15; margin-bottom:18px; letter-spacing:-.5px; }',
  '.ai-h2 .grad { background:linear-gradient(135deg,#60a5fa,#93c5fd); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }',
  '.ai-desc { font-size:15px; color:#64748b; line-height:1.75; margin-bottom:36px; }',
  '.ai-steps { display:flex; flex-direction:column; gap:0; }',
  '.ai-step { display:flex; gap:16px; position:relative; padding-bottom:24px; }',
  '.ai-step:not(:last-child)::before { content:""; position:absolute; left:19px; top:38px; bottom:0; width:2px; background:linear-gradient(to bottom,rgba(59,130,246,.4),rgba(59,130,246,.1)); }',
  '.ai-step-icon { width:38px; height:38px; border-radius:10px; background:rgba(59,130,246,.15); border:1px solid rgba(59,130,246,.3); display:flex; align-items:center; justify-content:center; flex-shrink:0; }',
  '.ai-step-text h4 { font-size:14px; font-weight:700; color:#e2e8f0; margin-bottom:3px; }',
  '.ai-step-text p { font-size:12px; color:#64748b; line-height:1.6; }',
  '.ai-terminal { background:#0a1628; border:1px solid rgba(59,130,246,.25); border-radius:14px; overflow:hidden; box-shadow:0 24px 80px rgba(0,0,0,.5),0 0 40px rgba(24,95,165,.1); }',
  '.ai-terminal-bar { background:rgba(255,255,255,.04); padding:10px 16px; display:flex; align-items:center; gap:8px; border-bottom:1px solid rgba(255,255,255,.06); }',
  '.ai-terminal-body { padding:20px; }',
  '.ai-file-card { background:rgba(24,95,165,.08); border:1px solid rgba(59,130,246,.2); border-radius:10px; padding:14px 16px; margin-bottom:12px; }',
  '.ai-file-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#3b82f6; margin-bottom:10px; display:flex; align-items:center; gap:6px; }',
  '.ai-field { display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#64748b; margin-bottom:5px; padding-bottom:5px; border-bottom:1px solid rgba(255,255,255,.04); }',
  '.ai-field:last-child { border:none; margin:0; padding:0; }',
  '.ai-field-val { color:#e2e8f0; font-weight:600; }',
  '.ai-status-bar { display:flex; align-items:center; gap:8px; background:rgba(34,197,94,.08); border:1px solid rgba(34,197,94,.2); border-radius:8px; padding:10px 14px; font-size:11px; color:#4ade80; font-weight:600; }',

  // FEATURES
  '.features-bg { padding:80px 0; }',
  '.features-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(290px,1fr)); gap:16px; }',
  '.feat-card { background:rgba(14,26,45,.7); border:1px solid rgba(24,95,165,.15); border-radius:14px; padding:28px; transition:border-color .2s,transform .2s; }',
  '.feat-card:hover { border-color:rgba(59,130,246,.4); transform:translateY(-3px); }',
  '.feat-icon { width:46px; height:46px; border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:18px; flex-shrink:0; }',
  '.feat-card h3 { font-size:15px; font-weight:700; color:#e2e8f0; margin-bottom:8px; }',
  '.feat-card p { font-size:13px; color:#64748b; line-height:1.65; }',

  // HOW IT WORKS
  '.how-bg { background:rgba(14,26,45,.5); padding:80px 0; border-top:1px solid rgba(24,95,165,.15); border-bottom:1px solid rgba(24,95,165,.15); }',
  '.steps-flow { display:flex; gap:0; align-items:flex-start; flex-wrap:wrap; }',
  '.step-item { flex:1; min-width:200px; text-align:center; padding:0 20px; position:relative; }',
  '.step-item:not(:last-child)::after { content:"→"; position:absolute; right:-16px; top:20px; font-size:20px; color:rgba(59,130,246,.4); }',
  '.step-circle { width:48px; height:48px; border-radius:50%; background:linear-gradient(135deg,#185FA5,#3b82f6); color:#fff; font-size:18px; font-weight:900; display:flex; align-items:center; justify-content:center; margin:0 auto 16px; box-shadow:0 4px 20px rgba(59,130,246,.3); }',
  '.step-item h3 { font-size:14px; font-weight:700; color:#e2e8f0; margin-bottom:8px; }',
  '.step-item p { font-size:12px; color:#64748b; line-height:1.65; }',

  // PRICING
  '.pricing-bg { padding:80px 0; }',
  '.pricing-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px; max-width:920px; margin:0 auto; }',
  '.price-card { background:rgba(14,26,45,.7); border:1px solid rgba(24,95,165,.2); border-radius:16px; padding:32px; position:relative; transition:border-color .2s,transform .2s; }',
  '.price-card:hover { transform:translateY(-4px); }',
  '.price-card.featured { border-color:rgba(59,130,246,.5); background:linear-gradient(145deg,rgba(14,26,45,.95),rgba(24,95,165,.12)); box-shadow:0 0 40px rgba(59,130,246,.12); }',
  '.price-pill { position:absolute; top:-12px; left:50%; transform:translateX(-50%); background:linear-gradient(135deg,#185FA5,#3b82f6); color:#fff; font-size:11px; font-weight:700; padding:4px 16px; border-radius:99px; white-space:nowrap; box-shadow:0 4px 12px rgba(59,130,246,.3); }',
  '.price-plan { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#64748b; margin-bottom:10px; }',
  '.price-amount { font-size:40px; font-weight:900; color:#f1f5f9; margin-bottom:4px; letter-spacing:-1px; }',
  '.price-amount span { font-size:14px; font-weight:400; color:#64748b; }',
  '.price-desc { font-size:13px; color:#64748b; margin-bottom:24px; line-height:1.6; }',
  '.price-list { list-style:none; display:flex; flex-direction:column; gap:10px; margin-bottom:28px; }',
  '.price-list li { display:flex; align-items:flex-start; gap:10px; font-size:13px; color:#94a3b8; }',
  '.chk { color:#22c55e; font-weight:700; flex-shrink:0; }',
  '.price-btn { width:100%; padding:13px; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer; text-decoration:none; display:block; text-align:center; transition:transform .15s,box-shadow .15s; }',
  '.price-btn-main { background:linear-gradient(135deg,#185FA5,#3b82f6); color:#fff; border:none; box-shadow:0 4px 16px rgba(59,130,246,.25); }',
  '.price-btn-main:hover { transform:translateY(-1px); box-shadow:0 8px 24px rgba(59,130,246,.4); }',
  '.price-btn-ghost { background:transparent; color:#3b82f6; border:2px solid rgba(59,130,246,.35); }',
  '.price-btn-ghost:hover { border-color:#3b82f6; background:rgba(59,130,246,.08); }',

  // TESTIMONIALS
  '.testi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px; }',
  '.testi-card { background:rgba(14,26,45,.7); border:1px solid rgba(24,95,165,.15); border-radius:14px; padding:28px; transition:border-color .2s; }',
  '.testi-card:hover { border-color:rgba(59,130,246,.3); }',
  '.testi-stars { color:#f59e0b; font-size:13px; margin-bottom:12px; letter-spacing:2px; }',
  '.testi-card p { font-size:14px; color:#94a3b8; line-height:1.75; margin-bottom:18px; font-style:italic; }',
  '.testi-author { display:flex; align-items:center; gap:12px; }',
  '.testi-avatar { width:38px; height:38px; border-radius:50%; background:linear-gradient(135deg,#185FA5,#3b82f6); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; color:#fff; flex-shrink:0; }',
  '.testi-name { font-size:13px; font-weight:600; color:#e2e8f0; }',
  '.testi-role { font-size:11px; color:#64748b; margin-top:1px; }',

  // SOCIAL SECTION
  '.social-section { background:rgba(14,26,45,.8); padding:72px 24px; text-align:center; border-top:1px solid rgba(24,95,165,.2); border-bottom:1px solid rgba(24,95,165,.2); }',
  '.social-bar { display:flex; justify-content:center; gap:14px; flex-wrap:wrap; margin-top:36px; }',
  '.social-btn { display:flex; align-items:center; gap:10px; padding:14px 24px; border-radius:12px; font-size:14px; font-weight:700; text-decoration:none; transition:transform .15s,box-shadow .15s; border:none; cursor:pointer; white-space:nowrap; }',
  '.social-btn:hover { transform:translateY(-3px); }',
  '.s-phone { background:linear-gradient(135deg,#16a34a,#22c55e); color:#fff; box-shadow:0 4px 20px rgba(34,197,94,.25); }',
  '.s-phone:hover { box-shadow:0 8px 28px rgba(34,197,94,.4); }',
  '.s-email { background:linear-gradient(135deg,#185FA5,#3b82f6); color:#fff; box-shadow:0 4px 20px rgba(59,130,246,.25); }',
  '.s-email:hover { box-shadow:0 8px 28px rgba(59,130,246,.4); }',
  '.s-ig { background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888); color:#fff; box-shadow:0 4px 20px rgba(220,39,67,.25); }',
  '.s-ig:hover { box-shadow:0 8px 28px rgba(220,39,67,.4); }',
  '.s-fb { background:linear-gradient(135deg,#1565c0,#1877f2); color:#fff; box-shadow:0 4px 20px rgba(24,119,242,.25); }',
  '.s-fb:hover { box-shadow:0 8px 28px rgba(24,119,242,.4); }',

  // CTA
  '.cta-section { padding:100px 24px; text-align:center; background:radial-gradient(ellipse 60% 50% at 50% 50%,rgba(24,95,165,.2) 0%,transparent 70%),#070d1a; position:relative; overflow:hidden; }',
  '.cta-glow { position:absolute; inset:0; background:radial-gradient(circle at 50% 50%,rgba(59,130,246,.08),transparent 70%); pointer-events:none; }',
  '.cta-h2 { font-size:clamp(28px,4vw,50px); font-weight:900; color:#f1f5f9; margin-bottom:16px; letter-spacing:-.5px; position:relative; }',
  '.cta-h2 .grad { background:linear-gradient(135deg,#60a5fa,#3b82f6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }',
  '.cta-sub { font-size:17px; color:#64748b; margin-bottom:40px; max-width:480px; margin-left:auto; margin-right:auto; line-height:1.75; position:relative; }',
  '.cta-btns { display:flex; justify-content:center; gap:14px; flex-wrap:wrap; position:relative; }',
  '.cta-note { margin-top:18px; font-size:12px; color:#334155; position:relative; }',

  // FOOTER
  'footer { background:#040912; padding:56px 24px 32px; border-top:1px solid rgba(24,95,165,.15); }',
  '.footer-inner { max-width:1200px; margin:0 auto; }',
  '.footer-top { display:flex; justify-content:space-between; gap:40px; flex-wrap:wrap; margin-bottom:40px; }',
  '.footer-logo-text { font-size:16px; font-weight:800; color:#e2e8f0; }',
  '.footer-logo-sub { font-size:10px; color:#334155; }',
  '.footer-brand-desc { font-size:13px; color:#334155; line-height:1.7; margin-top:12px; max-width:240px; }',
  '.footer-col h4 { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#475569; margin-bottom:14px; }',
  '.footer-col ul { list-style:none; display:flex; flex-direction:column; gap:8px; }',
  '.footer-col a { font-size:13px; color:#334155; text-decoration:none; transition:color .15s; }',
  '.footer-col a:hover { color:#94a3b8; }',
  '.footer-bottom { border-top:1px solid rgba(255,255,255,.04); padding-top:20px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; font-size:12px; color:#1e293b; }',

  // DIVIDER
  '.divider { border:none; border-top:1px solid rgba(24,95,165,.15); }',

  // ── TABLET ──────────────────────────────────────────────────────────────────
  '@media (max-width:900px) {',
  '  .hero-inner { grid-template-columns:1fr; gap:32px; text-align:center; }',
  '  .mockup-wrap { display:none; }',
  '  .hero-sub { margin:0 auto 32px; }',
  '  .hero-btns { justify-content:center; }',
  '  .hero-note { text-align:center; }',
  '  .ai-inner { grid-template-columns:1fr; gap:36px; }',
  '  .steps-flow { gap:24px; }',
  '  .step-item:not(:last-child)::after { display:none; }',
  '}',

  // ── MOBILE 768px ──────────────────────────────────────────────────────────
  '@media (max-width:768px) {',
  '  .nav-links,.nav-cta { display:none; }',
  '  .nav-mobile-btn { display:block; }',
  '  .nav-inner { padding:0 16px; }',

  // Hero
  '  .hero { padding:72px 16px 48px; min-height:auto; }',
  '  .hero h1 { font-size:32px; letter-spacing:-.5px; }',
  '  .hero-btns { flex-direction:column; align-items:stretch; gap:10px; }',
  '  .btn-cta-main,.btn-cta-sec { text-align:center; justify-content:center; width:100%; padding:14px 20px; font-size:15px; }',

  // Stats — 2×2 grid
  '  .stats-inner { display:grid; grid-template-columns:1fr 1fr; gap:0; }',
  '  .stat-item { padding:20px 16px; }',
  '  .stat-item:not(:last-child)::after { display:none; }',
  '  .stat-item:nth-child(1),.stat-item:nth-child(2) { border-bottom:1px solid rgba(24,95,165,.2); }',
  '  .stat-item:nth-child(1),.stat-item:nth-child(3) { border-right:1px solid rgba(24,95,165,.2); }',
  '  .stat-num { font-size:30px; }',

  // Sections
  '  .section-wrap { padding:52px 16px; }',
  '  .section-h2 { font-size:24px; }',
  '  .section-desc { font-size:14px; margin-bottom:36px; }',
  '  .section-tag { font-size:10px; }',

  // Events
  '  .events-grid { grid-template-columns:1fr; gap:12px; }',
  '  .event-card { padding:20px; }',

  // AI section
  '  .ai-bg { padding:52px 0; }',
  '  .ai-inner { padding:0 16px; gap:28px; }',
  '  .ai-h2 { font-size:26px; }',
  '  .ai-terminal-body { padding:14px; }',
  '  .ai-file-card { padding:12px; }',

  // Features
  '  .features-grid { grid-template-columns:1fr; gap:12px; }',
  '  .feat-card { padding:22px; }',

  // How it works — stack vertical
  '  .steps-flow { flex-direction:column; align-items:center; gap:0; }',
  '  .step-item { min-width:unset; width:100%; max-width:320px; padding:0 16px 28px; }',
  '  .step-item:last-child { padding-bottom:0; }',

  // Pricing
  '  .pricing-grid { grid-template-columns:1fr; gap:14px; max-width:100%; }',
  '  .price-card { padding:24px; }',
  '  .price-amount { font-size:34px; }',

  // Testimonials
  '  .testi-grid { grid-template-columns:1fr; gap:12px; }',
  '  .testi-card { padding:22px; }',

  // Social
  '  .social-section { padding:52px 16px; }',
  '  .social-bar { flex-direction:column; align-items:stretch; gap:10px; margin-top:28px; }',
  '  .social-btn { justify-content:center; padding:14px 20px; font-size:14px; border-radius:12px; }',

  // CTA
  '  .cta-section { padding:64px 16px; }',
  '  .cta-h2 { font-size:28px; }',
  '  .cta-sub { font-size:15px; }',
  '  .cta-btns { flex-direction:column; align-items:stretch; gap:10px; }',
  '  .cta-btns .btn-cta-main,.cta-btns .btn-cta-sec { justify-content:center; }',

  // Footer
  '  .footer-top { flex-direction:column; gap:28px; }',
  '  footer { padding:40px 16px 24px; }',
  '  .footer-bottom { flex-direction:column; align-items:center; gap:6px; text-align:center; }',
  '}',

  // ── SMALL MOBILE 480px ────────────────────────────────────────────────────
  '@media (max-width:480px) {',
  '  .hero h1 { font-size:28px; }',
  '  .hero-sub { font-size:14px; }',
  '  .hero-badge { font-size:11px; }',
  '  .stat-num { font-size:26px; }',
  '  .stat-label { font-size:11px; }',
  '  .section-h2 { font-size:22px; }',
  '  .ai-h2 { font-size:22px; }',
  '  .cta-h2 { font-size:24px; }',
  '  .price-amount { font-size:30px; }',
  '  .step-circle { width:42px; height:42px; font-size:16px; }',
  '}',
].join('\n')

// ─── DASHBOARD MOCKUP DATA ────────────────────────────────────────────────────
const MOCK_ROWS = [
  { nome: 'João Silva Santos',    evento: 'S-2220', status: 'ok',   label: 'Transmitido' },
  { nome: 'Ana Paula Ferreira',   evento: 'S-2240', status: 'pend', label: 'Pendente' },
  { nome: 'Carlos Eduardo Lima',  evento: 'S-2210', status: 'ok',   label: 'Transmitido' },
  { nome: 'Fernanda Rocha',       evento: 'S-2220', status: 'new',  label: 'Novo ASO' },
  { nome: 'Roberto Mendes',       evento: 'S-2240', status: 'ok',   label: 'Transmitido' },
]

// ─── COUNTER COMPONENT ────────────────────────────────────────────────────────
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const dur = 1600
        const steps = 60
        const inc = target / steps
        let cur = 0
        const timer = setInterval(() => {
          cur = Math.min(cur + inc, target)
          setCount(Math.round(cur))
          if (cur >= target) clearInterval(timer)
        }, dur / steps)
      }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [target])

  return <div ref={ref} className="stat-num">{count}{suffix}</div>
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [aiStep, setAiStep] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setAiStep(s => (s + 1) % 3), 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <>
      <Head>
        <title>eSocial SST — Transmissão automática com IA</title>
        <meta name="description" content="Transmita os eventos SST do eSocial (S-2210, S-2220, S-2221, S-2240) com inteligência artificial. Leia PDF de LTCAT, PCMSO e ASO automaticamente." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="eSocial SST — Transmissão automática com IA" />
        <meta property="og:description" content="Transmita os eventos SST do eSocial com IA. Leia PDF de LTCAT, PCMSO e ASO automaticamente." />
        <meta property="og:type" content="website" />
        <style dangerouslySetInnerHTML={{ __html: globalCSS }} />
      </Head>

      {/* ── NAV ── */}
      <nav>
        <div className="nav-inner">
          <a href="#" className="nav-logo">
            <img src="/logo-branca.png" alt="DSEG Consultoria" style={{ height:'100px', width:'auto' }} />
          </a>
          <div className="nav-links">
            <a href="#eventos">Eventos SST</a>
            <a href="#ia">IA &amp; Documentos</a>
            <a href="#funcionalidades">Funcionalidades</a>
            <a href="#precos">Preços</a>
            <a href="#contato">Contato</a>
          </div>
          <div className="nav-cta">
            <Link href="/login" className="btn-ghost">Entrar</Link>
            <Link href="/cadastro" className="btn-nav-cta">Testar grátis →</Link>
          </div>
          <button className="nav-mobile-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div style={{ background:'#070d1a', borderTop:'1px solid rgba(24,95,165,.2)', padding:'16px 24px', display:'flex', flexDirection:'column', gap:16 }}>
            {['#eventos','#ia','#funcionalidades','#precos','#contato'].map((href,i) => (
              <a key={i} href={href} style={{ fontSize:14, color:'#94a3b8', textDecoration:'none' }} onClick={() => setMenuOpen(false)}>
                {['Eventos SST','IA & Documentos','Funcionalidades','Preços','Contato'][i]}
              </a>
            ))}
            <div style={{ display:'flex', gap:10, paddingTop:8, borderTop:'1px solid rgba(255,255,255,.06)' }}>
              <Link href="/login" style={{ flex:1, textAlign:'center', textDecoration:'none', padding:'10px', fontSize:13, fontWeight:500, color:'#94a3b8', border:'1px solid rgba(255,255,255,.1)', borderRadius:8 }}>Entrar</Link>
              <Link href="/cadastro" style={{ flex:1, textAlign:'center', textDecoration:'none', padding:'10px', fontSize:13, fontWeight:600, color:'#fff', background:'linear-gradient(135deg,#185FA5,#3b82f6)', borderRadius:8 }}>Testar grátis</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-inner">
          {/* Left */}
          <div>
            <div className="hero-badge">
              <span className="badge-dot"></span>
              Sistema ao vivo · 100% conforme eSocial
            </div>
            <h1>
              Transmita o<br />
              <span className="grad">eSocial SST</span><br />
              com Inteligência Artificial
            </h1>
            <p className="hero-sub">
              Envie os eventos S-2210, S-2220, S-2221 e S-2240 diretamente ao governo.
              Importe PDF de LTCAT, PCMSO e ASO — a IA extrai e preenche tudo automaticamente.
            </p>
            <div className="hero-btns">
              <Link href="/cadastro" className="btn-cta-main">
                Começar trial grátis
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9,18 15,12 9,6"/></svg>
              </Link>
              <a href="#ia" className="btn-cta-sec">Ver como funciona</a>
            </div>
            <p className="hero-note">
              <span>14 dias grátis</span> · Sem cartão · Cancele quando quiser
            </p>
          </div>

          {/* Right — Dashboard Mockup */}
          <div className="mockup-wrap">
            <div className="mockup">
              <div className="mockup-bar">
                <div className="mock-dot" style={{ background:'#ef4444' }}></div>
                <div className="mock-dot" style={{ background:'#f59e0b' }}></div>
                <div className="mock-dot" style={{ background:'#22c55e' }}></div>
                <span className="mockup-title">eSocial SST — Dashboard</span>
              </div>
              <div className="mockup-body">
                <div className="mock-stats">
                  <div className="mock-stat-card">
                    <div className="mock-stat-num">47</div>
                    <div className="mock-stat-label">Transmitidos</div>
                  </div>
                  <div className="mock-stat-card">
                    <div className="mock-stat-num" style={{ color:'#fbbf24' }}>3</div>
                    <div className="mock-stat-label">Pendentes</div>
                  </div>
                  <div className="mock-stat-card">
                    <div className="mock-stat-num" style={{ color:'#4ade80' }}>12</div>
                    <div className="mock-stat-label">Hoje</div>
                  </div>
                </div>
                <div className="mock-table-header">
                  <span>Funcionário</span>
                  <span>Evento</span>
                  <span>Status</span>
                </div>
                {MOCK_ROWS.map((row, i) => (
                  <div key={i} className="mock-row">
                    <span className="mock-nome">{row.nome}</span>
                    <span className="mock-evento">{row.evento}</span>
                    <span className={`mock-badge mock-badge-${row.status}`}>{row.label}</span>
                  </div>
                ))}
                <div className="mock-ai-bar">
                  <div className="mock-ai-dot"></div>
                  IA aguardando próximo documento PDF...
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <div className="stats-section">
        <div className="stats-inner">
          {[
            { target:4,   suffix:'',  label:'Eventos SST suportados' },
            { target:3,   suffix:'',  label:'Documentos lidos por IA' },
            { target:14,  suffix:'d', label:'Trial gratuito' },
            { target:100, suffix:'%', label:'Conforme eSocial' },
          ].map((s,i) => (
            <div key={i} className="stat-item">
              <Counter target={s.target} suffix={s.suffix} />
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── EVENTOS SST ── */}
      <section id="eventos">
        <div className="section-wrap" style={{ textAlign:'center' }}>
          <div className="section-tag">Eventos SST</div>
          <h2 className="section-h2">Todos os eventos de <span className="grad">saúde e segurança</span></h2>
          <p className="section-desc">Transmita cada obrigação SST diretamente ao eSocial com validação automática antes do envio.</p>
          <div className="events-grid">
            {[
              { code:'S-2210', title:'Comunicação de Acidente', desc:'Registro e transmissão de CAT com todos os campos exigidos. Notificação automática de prazos.' },
              { code:'S-2220', title:'Monitoramento de Saúde', desc:'ASO completo vinculado ao funcionário, tipo de exame, médico responsável e validade automática.' },
              { code:'S-2221', title:'Exame Toxicológico', desc:'Exame toxicológico de longa janela para motoristas profissionais, conforme Lei 12.619/2012.' },
              { code:'S-2240', title:'Condições Ambientais', desc:'Agentes nocivos, EPIs, EPCs e LTCAT registrados por função. S-2240 só emitido para admissão, mudança, retorno e demissão.' },
            ].map((ev,i) => (
              <div key={i} className="event-card">
                <div className="event-code">{ev.code}</div>
                <h3>{ev.title}</h3>
                <p>{ev.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="divider" />

      {/* ── IA SECTION ── */}
      <section id="ia" className="ai-bg">
        <div className="ai-inner">
          <div>
            <div className="ai-tag">Inteligência Artificial</div>
            <h2 className="ai-h2">
              Importe um PDF.<br />
              <span className="grad">A IA faz o resto.</span>
            </h2>
            <p className="ai-desc">
              Envie qualquer PDF de LTCAT, PCMSO ou ASO. O sistema usa Claude (Anthropic) para identificar o tipo, extrair os dados e preencher os campos automaticamente.
            </p>
            <div className="ai-steps">
              {[
                { icon:'📄', title:'Carregue o PDF', desc:'Arraste ou selecione o arquivo. Suporte a qualquer formato de ASO, LTCAT ou PCMSO.' },
                { icon:'🤖', title:'IA analisa e extrai', desc:'Claude lê o documento, identifica campos e extrai dados com alta precisão.' },
                { icon:'📡', title:'Transmita ao eSocial', desc:'Dados preenchidos automaticamente. Revise e clique em transmitir.' },
              ].map((step,i) => (
                <div key={i} className="ai-step" style={{ opacity: aiStep === i ? 1 : 0.45, transition:'opacity .4s' }}>
                  <div className="ai-step-icon">
                    <span style={{ fontSize:16 }}>{step.icon}</span>
                  </div>
                  <div className="ai-step-text">
                    <h4>{step.title}</h4>
                    <p>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="ai-terminal">
              <div className="ai-terminal-bar">
                <div style={{ width:10, height:10, borderRadius:'50%', background:'#ef4444' }}></div>
                <div style={{ width:10, height:10, borderRadius:'50%', background:'#f59e0b' }}></div>
                <div style={{ width:10, height:10, borderRadius:'50%', background:'#22c55e' }}></div>
                <span style={{ marginLeft:8, fontSize:11, color:'#475569', fontFamily:'monospace' }}>claude-extractor · processando...</span>
              </div>
              <div className="ai-terminal-body">
                <div className="ai-file-card" style={{ opacity: aiStep === 0 ? 1 : 0.5, transition:'opacity .4s' }}>
                  <div className="ai-file-title">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>
                    Arquivo recebido
                  </div>
                  <div className="ai-field"><span>Arquivo:</span><span className="ai-field-val">ASO_joao_silva.pdf</span></div>
                  <div className="ai-field"><span>Tamanho:</span><span className="ai-field-val">248 KB</span></div>
                  <div className="ai-field"><span>Tipo detectado:</span><span className="ai-field-val" style={{ color:'#4ade80' }}>ASO — Admissional</span></div>
                </div>
                <div className="ai-file-card" style={{ opacity: aiStep === 1 ? 1 : 0.5, transition:'opacity .4s' }}>
                  <div className="ai-file-title">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                    Extração por IA
                  </div>
                  <div className="ai-field"><span>Funcionário:</span><span className="ai-field-val">João Silva Santos</span></div>
                  <div className="ai-field"><span>CPF:</span><span className="ai-field-val">123.456.789-00</span></div>
                  <div className="ai-field"><span>Médico:</span><span className="ai-field-val">Dr. Roberto Lima</span></div>
                  <div className="ai-field"><span>CRM:</span><span className="ai-field-val">SP-42891</span></div>
                  <div className="ai-field"><span>Resultado:</span><span className="ai-field-val" style={{ color:'#4ade80' }}>Apto</span></div>
                </div>
                <div className="ai-status-bar" style={{ opacity: aiStep === 2 ? 1 : 0.5, transition:'opacity .4s' }}>
                  <div style={{ width:8, height:8, background:'#22c55e', borderRadius:'50%', animation:'pulse-dot 1.5s infinite' }}></div>
                  Pronto para transmitir ao eSocial gov.br
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FUNCIONALIDADES ── */}
      <section id="funcionalidades" className="features-bg">
        <div className="section-wrap" style={{ textAlign:'center' }}>
          <div className="section-tag">Funcionalidades</div>
          <h2 className="section-h2">Tudo para <span className="grad">cumprir o eSocial SST</span></h2>
          <p className="section-desc">Plataforma completa para médicos do trabalho, engenheiros de segurança e RH.</p>
          <div className="features-grid">
            {[
              { bg:'rgba(24,95,165,.2)', ic:'#60a5fa', svg:<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>, title:'Transmissão gov.br', desc:'Envio direto ao ambiente de produção do eSocial com certificado digital A1/A3. Retorno de recibo automático.' },
              { bg:'rgba(168,85,247,.2)', ic:'#c084fc', svg:<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></>, title:'Multi-empresa', desc:'Gerencie várias empresas com um único login. Ideal para escritórios de SST e prestadores de serviço.' },
              { bg:'rgba(34,197,94,.15)', ic:'#4ade80', svg:<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>, title:'Alertas de vencimento', desc:'Receba e-mail sobre ASOs próximos do vencimento antes do prazo acabar.' },
              { bg:'rgba(251,191,36,.15)', ic:'#fbbf24', svg:<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></>, title:'Painel administrativo', desc:'Visão completa do SaaS: clientes, planos, uso de IA, transmissões e status do sistema.' },
              { bg:'rgba(249,115,22,.15)', ic:'#fb923c', svg:<><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/></>, title:'Cadastro de funcionários', desc:'Base centralizada com CPF, função, CBO, setor e histórico de exames de toda a empresa.' },
              { bg:'rgba(20,184,166,.15)', ic:'#2dd4bf', svg:<polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>, title:'Histórico de transmissões', desc:'Consulte todos os eventos enviados, recibos do eSocial, XML gerado e status de cada envio.' },
            ].map((f,i) => (
              <div key={i} className="feat-card">
                <div className="feat-icon" style={{ background:f.bg }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={f.ic} strokeWidth="2">{f.svg}</svg>
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section className="how-bg">
        <div className="section-wrap" style={{ textAlign:'center' }}>
          <div className="section-tag">Como funciona</div>
          <h2 className="section-h2">Em <span className="grad">4 passos</span> simples</h2>
          <p className="section-desc">Do cadastro à transmissão em minutos, sem conhecimento técnico em XML.</p>
          <div className="steps-flow">
            {[
              { n:'1', title:'Crie sua conta', desc:'Trial gratuito de 14 dias. Cadastre empresa e funcionários.' },
              { n:'2', title:'Importe ou preencha', desc:'Envie um PDF ou preencha o evento SST manualmente.' },
              { n:'3', title:'Valide com a IA', desc:'A IA verifica os dados e aponta inconsistências.' },
              { n:'4', title:'Transmita', desc:'Assina, envia ao gov.br e salva o recibo automaticamente.' },
            ].map((s,i) => (
              <div key={i} className="step-item">
                <div className="step-circle">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="divider" />

      {/* ── PREÇOS ── */}
      <section id="precos" className="pricing-bg">
        <div className="section-wrap" style={{ textAlign:'center' }}>
          <div className="section-tag">Planos</div>
          <h2 className="section-h2">Simples e <span className="grad">transparente</span></h2>
          <p className="section-desc">Comece grátis e escolha o plano ideal para sua operação.</p>
          <div className="pricing-grid">
            {/* Micro */}
            <div className="price-card">
              <div className="price-plan">Micro</div>
              <div className="price-amount">R$ 49<span>/mês</span></div>
              <p className="price-desc">50 envios incluídos · R$ 1,90 por envio extra.</p>
              <ul className="price-list" style={{ textAlign:'left' }}>
                {['50 envios/mês incluídos','Importação por IA (PDF)','ASO, LTCAT e PCMSO','Transmissão eSocial S-2210/2220/2221/2240','Alertas de vencimento','Exportação de PDF'].map((item,i) => (
                  <li key={i}><span className="chk">✓</span>{item}</li>
                ))}
              </ul>
              <Link href="/cadastro" className="price-btn price-btn-ghost">Começar grátis</Link>
            </div>
            {/* Starter */}
            <div className="price-card featured">
              <div className="price-pill">Mais popular</div>
              <div className="price-plan">Starter</div>
              <div className="price-amount">R$ 97<span>/mês</span></div>
              <p className="price-desc">100 envios incluídos · R$ 1,50 por envio extra.</p>
              <ul className="price-list" style={{ textAlign:'left' }}>
                {['100 envios/mês incluídos','Tudo do Micro','Multi-empresa (até 5 CNPJs)','Convite de usuários','Relatórios avançados','Suporte por e-mail'].map((item,i) => (
                  <li key={i}><span className="chk">✓</span>{item}</li>
                ))}
              </ul>
              <Link href="/cadastro" className="price-btn price-btn-main">Começar grátis</Link>
            </div>
            {/* Pro */}
            <div className="price-card">
              <div className="price-plan">Pro</div>
              <div className="price-amount">R$ 197<span>/mês</span></div>
              <p className="price-desc">400 envios incluídos · R$ 1,20 por envio extra.</p>
              <ul className="price-list" style={{ textAlign:'left' }}>
                {['400 envios/mês incluídos','Tudo do Starter','Até 10 CNPJs','Suporte prioritário','Onboarding dedicado','Envios excedentes automáticos'].map((item,i) => (
                  <li key={i}><span className="chk">✓</span>{item}</li>
                ))}
              </ul>
              <Link href="/cadastro" className="price-btn price-btn-ghost">Começar grátis</Link>
            </div>
          </div>
          <p style={{ textAlign:'center', marginTop:28, fontSize:12, color:'#334155' }}>
            Todos os planos incluem 14 dias grátis · Mensalidade fixa + envios incluídos · Cancele quando quiser
          </p>
        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <section>
        <div className="section-wrap" style={{ textAlign:'center' }}>
          <div className="section-tag">Depoimentos</div>
          <h2 className="section-h2">Quem já usa o <span className="grad">eSocial SST</span></h2>
          <p className="section-desc">Profissionais de SST economizando horas por semana em todo o Brasil.</p>
          <div className="testi-grid">
            {[
              { init:'MC', nome:'Márcia C.', role:'Médica do Trabalho · São Paulo', text:'Antes gastava horas preenchendo XML. Agora importo o PDF do ASO e em segundos está pronto para transmitir. Incrível.' },
              { init:'RF', nome:'Ricardo F.', role:'Engenheiro de Segurança · Curitiba', text:'Gerencio 12 empresas aqui. O multi-empresa é perfeito — cada uma isolada mas acesso tudo com um login só.' },
              { init:'PS', nome:'Patricia S.', role:'Analista de RH · Belo Horizonte', text:'O alerta de vencimento de ASO salvou minha empresa de uma autuação. O sistema avisou 30 dias antes.' },
            ].map((t,i) => (
              <div key={i} className="testi-card">
                <div className="testi-stars">★★★★★</div>
                <p>&quot;{t.text}&quot;</p>
                <div className="testi-author">
                  <div className="testi-avatar">{t.init}</div>
                  <div>
                    <div className="testi-name">{t.nome}</div>
                    <div className="testi-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REDES SOCIAIS ── */}
      <section id="contato" className="social-section">
        <div className="section-tag">Fale conosco</div>
        <h2 className="section-h2" style={{ marginBottom:8 }}>
          Estamos nas <span className="grad">redes sociais</span>
        </h2>
        <p style={{ fontSize:15, color:'#64748b', maxWidth:460, margin:'0 auto', lineHeight:1.75 }}>
          Tire dúvidas, peça suporte ou conheça mais sobre a Dseg Consultoria.
        </p>
        <div className="social-bar">
          <a href="tel:+5564992090277" className="social-btn s-phone">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
            (64) 99209-0277
          </a>
          <a href="mailto:dseg.sst@gmail.com" className="social-btn s-email">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            dseg.sst@gmail.com
          </a>
          <a href="https://instagram.com/dseg.sst" target="_blank" rel="noopener noreferrer" className="social-btn s-ig">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
            @dseg.sst
          </a>
          <a href="https://web.facebook.com/profile.php?id=61565545266445" target="_blank" rel="noopener noreferrer" className="social-btn s-fb">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
            </svg>
            Dseg Consultoria
          </a>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="cta-glow"></div>
        <h2 className="cta-h2">
          Comece seu trial<br /><span className="grad">grátis hoje</span>
        </h2>
        <p className="cta-sub">
          14 dias para explorar todas as funcionalidades. Sem cartão de crédito, sem compromisso.
        </p>
        <div className="cta-btns">
          <Link href="/cadastro" className="btn-cta-main">Criar conta grátis</Link>
          <Link href="/login" className="btn-cta-sec">Já tenho conta — entrar</Link>
        </div>
        <p className="cta-note">Suporte em até 24h · Dados hospedados no Brasil · LGPD</p>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <div className="footer-inner">
          <div className="footer-top">
            <div>
              <div style={{ display:'flex', alignItems:'center' }}>
                <img src="/logo-branca.png" alt="DSEG Consultoria" style={{ height:'80px', width:'auto' }} />
              </div>
              <p className="footer-brand-desc">Plataforma SaaS para transmissão de eventos SST ao eSocial com inteligência artificial.</p>
            </div>
            <div className="footer-col">
              <h4>Produto</h4>
              <ul>
                <li><a href="#eventos">Eventos SST</a></li>
                <li><a href="#ia">IA &amp; Documentos</a></li>
                <li><a href="#funcionalidades">Funcionalidades</a></li>
                <li><a href="#precos">Preços</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Conta</h4>
              <ul>
                <li><Link href="/login">Entrar</Link></li>
                <li><Link href="/cadastro">Criar conta</Link></li>
                <li><Link href="/dashboard">Dashboard</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Contato</h4>
              <ul>
                <li><a href="tel:+5564992090277">(64) 99209-0277</a></li>
                <li><a href="mailto:dseg.sst@gmail.com">dseg.sst@gmail.com</a></li>
                <li><a href="https://instagram.com/dseg.sst" target="_blank" rel="noopener noreferrer">Instagram @dseg.sst</a></li>
                <li><a href="https://web.facebook.com/profile.php?id=61565545266445" target="_blank" rel="noopener noreferrer">Facebook</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span suppressHydrationWarning>© {new Date().getFullYear()} eSocial SST — Dseg Consultoria. Todos os direitos reservados.</span>
            <span>Desenvolvido no Brasil 🇧🇷</span>
          </div>
        </div>
      </footer>
    </>
  )
}
