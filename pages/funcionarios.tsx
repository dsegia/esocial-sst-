import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Func = {
  id: string; nome: string; cpf: string; data_nasc: string
  data_adm: string; matricula_esocial: string; funcao: string
  setor: string; vinculo: string; ativo: boolean
}

export default function Funcionarios() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState('')
  const [lista, setLista] = useState<Func[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [form, setForm] = useState({
    nome: '', cpf: '', data_nasc: '', data_adm: '',
    matricula_esocial: '', funcao: '', setor: '', vinculo: 'CLT', turno: 'Diurno'
  })

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    const { data: user } = await supabase.from('usuarios').select('empresa_id').eq('id', session.user.id).single()
    if (!user) { router.push('/'); return }
    setEmpresaId(user.empresa_id)
    await carregar(user.empresa_id, '')
    setCarregando(false)
  }

  async function carregar(eId: string, q: string) {
    let query = supabase.from('funcionarios').select('*').eq('empresa_id', eId).eq('ativo', true).order('nome')
    if (q) query = query.or(`nome.ilike.%${q}%,cpf.ilike.%${q}%,matricula_esocial.ilike.%${q}%`)
    const { data } = await query
    setLista(data as Func[] || [])
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSucesso('')
    const { error } = await supabase.from('funcionarios').insert({ ...form, empresa_id: empresaId })
    if (error) { setErro('Erro: ' + (error.message.includes('unique') ? 'CPF ou matrícula já cadastrado.' : error.message)); return }
    setSucesso('Funcionário cadastrado com sucesso!')
    setForm({ nome: '', cpf: '', data_nasc: '', data_adm: '', matricula_esocial: '', funcao: '', setor: '', vinculo: 'CLT', turno: 'Diurno' })
    setMostrarForm(false)
    carregar(empresaId, busca)
  }

  async function desativar(id: string, nome: string) {
    if (!confirm(`Desativar ${nome}?`)) return
    await supabase.from('funcionarios').update({ ativo: false }).eq('id', id)
    carregar(empresaId, busca)
  }

  function fmtCPF(v: string) {
    return v.replace(/\D/g, '').substring(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
  }

  const listaFiltrada = lista.filter(f =>
    !busca || f.nome.toLowerCase().includes(busca.toLowerCase()) ||
    f.cpf.includes(busca) || (f.matricula_esocial || '').toLowerCase().includes(busca.toLowerCase())
  )

  if (carregando) return <div style={s.loading}>Carregando...</div>

  return (
    <Layout pagina="funcionarios">
      <Head><title>Funcionários — eSocial SST</title></Head>

      <div style={s.header}>
        <div>
          <div style={s.titulo}>Funcionários</div>
          <div style={s.sub}>{lista.length} cadastrado(s)</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={s.busca} placeholder="Buscar por nome, CPF ou matrícula..."
            value={busca} onChange={e => { setBusca(e.target.value); carregar(empresaId, e.target.value) }} />
          <button style={s.btnPrimary} onClick={() => setMostrarForm(!mostrarForm)}>
            {mostrarForm ? 'Cancelar' : '+ Adicionar'}
          </button>
        </div>
      </div>

      {sucesso && <div style={s.sucessoBox}>{sucesso}</div>}

      {mostrarForm && (
        <div style={s.formCard}>
          <div style={s.cardTitulo}>Novo funcionário</div>
          <form onSubmit={salvar}>
            <div style={s.row2}>
              <div style={s.field}><label style={s.label}>Nome completo *</label>
                <input style={s.input} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required /></div>
              <div style={s.field}><label style={s.label}>CPF *</label>
                <input style={s.input} value={form.cpf} onChange={e => setForm({ ...form, cpf: fmtCPF(e.target.value) })} required /></div>
            </div>
            <div style={s.row3}>
              <div style={s.field}><label style={s.label}>Nascimento *</label>
                <input style={s.input} type="date" value={form.data_nasc} onChange={e => setForm({ ...form, data_nasc: e.target.value })} required /></div>
              <div style={s.field}><label style={s.label}>Admissão *</label>
                <input style={s.input} type="date" value={form.data_adm} onChange={e => setForm({ ...form, data_adm: e.target.value })} required /></div>
              <div style={s.field}><label style={s.label}>Matrícula eSocial *</label>
                <input style={s.input} value={form.matricula_esocial} onChange={e => setForm({ ...form, matricula_esocial: e.target.value })} required /></div>
            </div>
            <div style={s.row2}>
              <div style={s.field}><label style={s.label}>Função / CBO</label>
                <input style={s.input} value={form.funcao} onChange={e => setForm({ ...form, funcao: e.target.value })} /></div>
              <div style={s.field}><label style={s.label}>Setor / GHE</label>
                <input style={s.input} value={form.setor} onChange={e => setForm({ ...form, setor: e.target.value })} /></div>
            </div>
            <div style={s.row2}>
              <div style={s.field}><label style={s.label}>Vínculo</label>
                <select style={s.input} value={form.vinculo} onChange={e => setForm({ ...form, vinculo: e.target.value })}>
                  <option>CLT</option><option>Temporário</option><option>Aprendiz</option><option>Estagiário</option>
                </select>
              </div>
              <div style={s.field}><label style={s.label}>Turno</label>
                <select style={s.input} value={form.turno} onChange={e => setForm({ ...form, turno: e.target.value })}>
                  <option>Diurno</option><option>Vespertino</option><option>Noturno</option><option>Misto / 12x36</option>
                </select>
              </div>
            </div>
            {erro && <div style={s.erroBox}>{erro}</div>}
            <button type="submit" style={s.btnPrimary}>Salvar funcionário</button>
          </form>
        </div>
      )}

      <div style={s.tabela}>
        <table style={s.table}>
          <thead>
            <tr style={s.thead}>
              <th style={s.th}>Nome</th><th style={s.th}>CPF</th>
              <th style={s.th}>Admissão</th><th style={s.th}>Função</th>
              <th style={s.th}>Setor</th><th style={s.th}>Matrícula</th><th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: 13 }}>
                {busca ? 'Nenhum resultado.' : 'Nenhum funcionário cadastrado ainda.'}
              </td></tr>
            ) : listaFiltrada.map(f => (
              <tr key={f.id} style={s.tr}>
                <td style={s.td}><span style={{ fontWeight: 500 }}>{f.nome}</span></td>
                <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 12 }}>{f.cpf}</td>
                <td style={s.td}>{f.data_adm ? new Date(f.data_adm + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                <td style={s.td}>{f.funcao || '—'}</td>
                <td style={s.td}>{f.setor || '—'}</td>
                <td style={s.td}><span style={s.badge}>{f.matricula_esocial}</span></td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={s.btnAcao} onClick={() => router.push(`/s2220?func=${f.id}`)}>ASO</button>
                    <button style={{ ...s.btnAcao, color: '#791F1F', borderColor: '#F09595' }}
                      onClick={() => desativar(f.id, f.nome)}>Remover</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}

const s: Record<string, React.CSSProperties> = {
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontSize: 14, color: '#6b7280', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' },
  titulo: { fontSize: 20, fontWeight: 700, color: '#111' },
  sub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  busca: { padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, width: 300, fontFamily: 'inherit' },
  btnPrimary: { padding: '8px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  sucesso: {}, sucessoBox: { background: '#EAF3DE', color: '#27500A', border: '0.5px solid #C0DD97', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  formCard: { background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' },
  cardTitulo: { fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 14 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 },
  field: {},
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 },
  input: { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box', fontFamily: 'inherit' },
  erroBox: { background: '#FCEBEB', color: '#791F1F', border: '0.5px solid #F7C1C1', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  tabela: { background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f9fafb' },
  th: { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '0.5px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tr: { borderBottom: '0.5px solid #f3f4f6' },
  td: { padding: '10px 12px', fontSize: 13, color: '#374151' },
  badge: { background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500 },
  btnAcao: { padding: '3px 10px', fontSize: 11, background: 'transparent', border: '0.5px solid #d1d5db', borderRadius: 6, cursor: 'pointer', color: '#374151' },
}
