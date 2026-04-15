import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'
import { getEmpresaId, setEmpresaId } from '../lib/empresa'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Empresa = {
  id: string
  razao_social: string
  cnpj: string
  cnae?: string
  cert_digital_validade?: string
  cert_titular?: string
  perfil?: string
  funcionarios_count?: number
}

const formVazio = () => ({
  razao_social: '', cnpj: '', cnae: '', endereco: '',
  municipio: '', uf: 'SP', cep: '', resp_nome: '', resp_cpf: '',
})

export default function Empresas() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaAtualId, setEmpresaAtualId] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(formVazio())
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    setUserId(session.user.id)
    setEmpresaAtualId(getEmpresaId() || '')
    await carregar(session.user.id)
    setCarregando(false)
  }

  async function carregar(uid: string) {
    // Tenta via RPC get_minhas_empresas (multi-empresa)
    const { data: rpcData } = await supabase.rpc('get_minhas_empresas')
    if (rpcData && rpcData.length > 0) {
      // Busca detalhes extras de cada empresa
      const ids = rpcData.map((e: any) => e.id)
      const { data: detalhes } = await supabase
        .from('empresas')
        .select('id, razao_social, cnpj, cnae, cert_digital_validade, cert_titular')
        .in('id', ids)
      const { data: funcCounts } = await supabase
        .from('funcionarios')
        .select('empresa_id')
        .in('empresa_id', ids)
        .eq('ativo', true)
      const contagemMap: Record<string, number> = {}
      funcCounts?.forEach((f: any) => { contagemMap[f.empresa_id] = (contagemMap[f.empresa_id] || 0) + 1 })
      const mescladas = rpcData.map((r: any) => {
        const d = detalhes?.find((x: any) => x.id === r.id) || {}
        return { ...d, ...r, funcionarios_count: contagemMap[r.id] || 0 }
      })
      setEmpresas(mescladas)
    } else {
      // Fallback: empresa única do usuário
      const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', uid).single()
      if (user?.empresa_id) {
        const { data: emp } = await supabase.from('empresas')
          .select('id, razao_social, cnpj, cnae, cert_digital_validade, cert_titular')
          .eq('id', user.empresa_id).single()
        if (emp) {
          const { data: funcs } = await supabase.from('funcionarios').select('id').eq('empresa_id', emp.id).eq('ativo', true)
          setEmpresas([{ ...emp, perfil: 'admin', funcionarios_count: funcs?.length || 0 }])
          setEmpresaAtualId(emp.id)
        }
      }
    }
  }

  function entrarNaEmpresa(id: string) {
    setEmpresaId(id)
    router.push('/dashboard')
  }

  function fmtCNPJ(v: string) {
    const n = v.replace(/\D/g, '').slice(0, 14)
    return n.replace(/(\d{2})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1/$2')
            .replace(/(\d{4})(\d)/, '$1-$2')
  }

  async function salvarNovaEmpresa(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setSucesso(''); setSalvando(true)
    if (!form.razao_social.trim()) { setErro('Razão social é obrigatória.'); setSalvando(false); return }
    const cnpjLimpo = form.cnpj.replace(/\D/g, '')
    if (cnpjLimpo.length !== 14) { setErro('CNPJ inválido — deve ter 14 dígitos.'); setSalvando(false); return }

    // Verifica se CNPJ já existe
    const { data: existe } = await supabase.from('empresas').select('id, razao_social').eq('cnpj', form.cnpj).single()
    if (existe) {
      // Empresa já existe — vincular ao usuário
      const { error: vinErr } = await supabase.from('usuario_empresas').upsert({
        usuario_id: userId, empresa_id: existe.id, perfil: 'admin', tipo_acesso: 'empresa',
      }, { onConflict: 'usuario_id,empresa_id' })
      if (vinErr) { setErro('Erro ao vincular empresa: ' + vinErr.message); setSalvando(false); return }
      setSucesso(`Empresa "${existe.razao_social}" vinculada à sua conta.`)
      setMostrarForm(false); setForm(formVazio())
      await carregar(userId)
      setSalvando(false); return
    }

    // Criar nova empresa
    const { data: novaEmp, error: empErr } = await supabase.from('empresas').insert({
      razao_social: form.razao_social.trim(),
      cnpj: form.cnpj,
      cnae: form.cnae.trim() || null,
      endereco: form.endereco.trim() || null,
      municipio: form.municipio.trim() || null,
      uf: form.uf,
      cep: form.cep.trim() || null,
      resp_nome: form.resp_nome.trim() || null,
      resp_cpf: form.resp_cpf.trim() || null,
    }).select().single()

    if (empErr) { setErro('Erro ao criar empresa: ' + empErr.message); setSalvando(false); return }

    // Vincular ao usuário
    await supabase.from('usuario_empresas').upsert({
      usuario_id: userId, empresa_id: novaEmp.id, perfil: 'admin', tipo_acesso: 'empresa',
    }, { onConflict: 'usuario_id,empresa_id' })

    setSucesso(`Empresa "${novaEmp.razao_social}" criada com sucesso!`)
    setMostrarForm(false); setForm(formVazio())
    await carregar(userId)
    setSalvando(false)
  }

  function initials(nome: string) {
    return nome.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase()
  }

  function diasParaVencer(data?: string) {
    if (!data) return null
    return Math.ceil((new Date(data).getTime() - Date.now()) / 86400000)
  }

  if (carregando) return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', fontFamily:'sans-serif', fontSize:14, color:'#6b7280' }}>Carregando...</div>

  return (
    <Layout pagina="empresas">
      <Head><title>Empresas — eSocial SST</title></Head>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:'#111' }}>Empresas</div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{empresas.length} empresa(s) vinculada(s) à sua conta</div>
        </div>
        <button onClick={() => { setMostrarForm(true); setErro(''); setSucesso('') }}
          style={{ padding:'8px 16px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>
          + Adicionar empresa
        </button>
      </div>

      {sucesso && <div style={{ background:'#EAF3DE', color:'#27500A', border:'0.5px solid #C0DD97', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14 }}>{sucesso}</div>}
      {erro    && <div style={{ background:'#FCEBEB', color:'#791F1F', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14 }}>{erro}</div>}

      {/* Campo de busca — aparece só quando há 5+ empresas */}
      {empresas.length >= 5 && (
        <div style={{ marginBottom:14 }}>
          <input
            type="text"
            placeholder="Buscar por nome ou CNPJ..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ width:'100%', padding:'9px 12px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' }}
          />
        </div>
      )}

      {/* Formulário nova empresa */}
      {mostrarForm && (
        <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:600, color:'#111' }}>Adicionar empresa</div>
            <button onClick={() => setMostrarForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#9ca3af', lineHeight:1 }}>×</button>
          </div>
          <div style={{ background:'#E6F1FB', border:'0.5px solid #B5D4F4', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#0C447C', marginBottom:14 }}>
            Se o CNPJ já estiver cadastrado no sistema, a empresa será vinculada automaticamente à sua conta.
          </div>
          <form onSubmit={salvarNovaEmpresa}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <label style={s.label}>Razão social *</label>
                <input style={s.input} value={form.razao_social} onChange={e => setForm({...form, razao_social:e.target.value})} required />
              </div>
              <div>
                <label style={s.label}>CNPJ *</label>
                <input style={s.input} placeholder="00.000.000/0001-00" value={form.cnpj}
                  onChange={e => setForm({...form, cnpj: fmtCNPJ(e.target.value)})} required />
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <label style={s.label}>CNAE principal</label>
                <input style={s.input} placeholder="Ex: 7119701" value={form.cnae} onChange={e => setForm({...form, cnae:e.target.value})} />
              </div>
              <div>
                <label style={s.label}>Município</label>
                <input style={s.input} value={form.municipio} onChange={e => setForm({...form, municipio:e.target.value})} />
              </div>
              <div>
                <label style={s.label}>UF</label>
                <select style={s.input} value={form.uf} onChange={e => setForm({...form, uf:e.target.value})}>
                  {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(uf => <option key={uf}>{uf}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
              <div>
                <label style={s.label}>Responsável (nome)</label>
                <input style={s.input} value={form.resp_nome} onChange={e => setForm({...form, resp_nome:e.target.value})} />
              </div>
              <div>
                <label style={s.label}>CPF do responsável</label>
                <input style={s.input} placeholder="000.000.000-00" value={form.resp_cpf} onChange={e => setForm({...form, resp_cpf:e.target.value})} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button type="submit" disabled={salvando}
                style={{ padding:'8px 16px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', opacity:salvando?0.6:1 }}>
                {salvando ? 'Salvando...' : 'Salvar empresa'}
              </button>
              <button type="button" onClick={() => setMostrarForm(false)}
                style={{ padding:'8px 16px', background:'transparent', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', color:'#374151' }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de empresas */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {empresas.length === 0 ? (
          <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'3rem', textAlign:'center', color:'#9ca3af', fontSize:13 }}>
            Nenhuma empresa vinculada.
          </div>
        ) : (() => {
          const filtradas = empresas.filter(emp => {
            if (!busca.trim()) return true
            const t = busca.toLowerCase()
            return emp.razao_social.toLowerCase().includes(t) || emp.cnpj.replace(/\D/g,'').includes(busca.replace(/\D/g,''))
          })
          if (filtradas.length === 0) return (
            <div style={{ background:'#fff', border:'0.5px solid #e5e7eb', borderRadius:12, padding:'3rem', textAlign:'center', color:'#9ca3af', fontSize:13 }}>
              Nenhuma empresa encontrada para "{busca}".
            </div>
          )
          return filtradas.map(emp => {
          const ativa = emp.id === empresaAtualId
          const dias = diasParaVencer(emp.cert_digital_validade)
          const certOk = dias !== null && dias > 30
          const certCrit = dias !== null && dias >= 0 && dias <= 30
          const certVenc = dias !== null && dias < 0
          const semCert = dias === null

          return (
            <div key={emp.id} style={{
              background:'#fff', border: ativa ? '1.5px solid #185FA5' : '0.5px solid #e5e7eb',
              borderRadius:12, padding:'1.25rem', display:'flex', alignItems:'center', gap:16,
              boxShadow: ativa ? '0 0 0 3px #E6F1FB' : 'none',
            }}>
              {/* Avatar */}
              <div style={{ width:48, height:48, borderRadius:10, background: ativa ? '#185FA5' : '#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <span style={{ fontSize:14, fontWeight:700, color: ativa ? '#fff' : '#6b7280' }}>
                  {initials(emp.razao_social)}
                </span>
              </div>

              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {emp.razao_social}
                  </div>
                  {ativa && (
                    <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:600, background:'#E6F1FB', color:'#185FA5', flexShrink:0 }}>
                      Ativa
                    </span>
                  )}
                  {emp.perfil && (
                    <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:500, background:'#f3f4f6', color:'#6b7280', flexShrink:0, textTransform:'capitalize' }}>
                      {emp.perfil}
                    </span>
                  )}
                </div>
                <div style={{ fontSize:12, color:'#6b7280', display:'flex', gap:12, flexWrap:'wrap' }}>
                  <span>{emp.cnpj || '—'}</span>
                  {emp.cnae && <span>CNAE {emp.cnae}</span>}
                  <span>{emp.funcionarios_count} funcionário(s)</span>
                </div>
              </div>

              {/* Status certificado */}
              <div style={{ textAlign:'center', flexShrink:0 }}>
                {semCert && (
                  <div style={{ padding:'4px 10px', borderRadius:8, background:'#f3f4f6', fontSize:11, color:'#9ca3af' }}>
                    Sem certificado
                  </div>
                )}
                {certOk && (
                  <div style={{ padding:'4px 10px', borderRadius:8, background:'#EAF3DE', fontSize:11, color:'#27500A' }}>
                    Cert. válido · {dias}d
                  </div>
                )}
                {certCrit && (
                  <div style={{ padding:'4px 10px', borderRadius:8, background:'#FAEEDA', fontSize:11, color:'#633806' }}>
                    Cert. vence em {dias}d
                  </div>
                )}
                {certVenc && (
                  <div style={{ padding:'4px 10px', borderRadius:8, background:'#FCEBEB', fontSize:11, color:'#791F1F' }}>
                    Certificado vencido
                  </div>
                )}
              </div>

              {/* Ações */}
              <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                {!ativa && (
                  <button onClick={() => entrarNaEmpresa(emp.id)}
                    style={{ padding:'7px 14px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer' }}>
                    Entrar
                  </button>
                )}
                <button onClick={() => { setEmpresaId(emp.id); router.push('/configuracoes') }}
                  style={{ padding:'7px 14px', background:'transparent', border:'0.5px solid #d1d5db', borderRadius:8, fontSize:12, cursor:'pointer', color:'#374151' }}>
                  Configurar
                </button>
              </div>
            </div>
          )
          })
        })()}
      </div>
    </Layout>
  )
}

const s: Record<string, React.CSSProperties> = {
  label: { display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:4 },
  input: { width:'100%', padding:'8px 10px', fontSize:13, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', color:'#111', boxSizing:'border-box', fontFamily:'inherit' },
}
