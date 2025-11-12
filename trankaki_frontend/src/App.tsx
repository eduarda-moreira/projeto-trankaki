import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookIcon,
  CalendarIcon,
  Download,
  Loader2,
  Lock,
  Search,
  Users2,
  Wallet,
} from "lucide-react";
import { toast, Toaster } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import logoUrl from "./assets/trankaki.svg"; 


// ====================== CONFIG ======================
const API_BASE = import.meta.env?.VITE_API_BASE ?? "http://localhost:3000";

// ====================== TIPOS ======================
type Armario = {
  armario_id: number;
  cod_armario: string;
  tamanho: "P" | "M" | "G";
  status: "Disponível" | "Ocupado" | "Manutenção";
  praia_nome: string;
  cidade: string;
};

type Pagamento = {
  id: number;
  usuario_id: number;
  alvo: "aluguel" | "multa";
  alvo_id: number;
  valor: number;
  metodo: "pix" | "cartao" | "boleto";
  data: string;
};

type Devedor = {
  usuario_id: number;
  total_em_aberto: number;
};


type Praia = {
  id: number;
  nome: string;
  cidade: string;
};

type ArmarioOcupado = {
  id: number;
  cod_armario: string;
  praia_nome: string;
};

type UsuarioResumo = {
  id: number;
  nome: string;
  cpf: string;
};

// ====================== UTILS ======================
async function parseJSONorText(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function fetchJSON(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  const data = await parseJSONorText(res);
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || (typeof data === "string" ? data : JSON.stringify(data));
    throw new Error(msg);
  }
  return data;
}

function fmtBRL(v?: number) {
  if (v == null || isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function exportCSV(filename: string, rows: Array<Record<string, any>>) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => String(r[h] ?? "")).join(";")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ====================== APP ======================
export default function App() {
  // Abas
  const [activeTab, setActiveTab] = useState<"disponibilidade" | "aluguéis" | "pagamentos" | "devedores">("disponibilidade");

  // FILTROS – Disponibilidade
  const [praiaNome, setPraiaNome] = useState("");
  const [tamanho, setTamanho] = useState<"all" | "P" | "M" | "G">("all");
  const [status, setStatus] = useState<"all" | "Disponível" | "Ocupado" | "Manutenção">("all");
  const [inicio, setInicio] = useState<Date | undefined>();
  const [fim, setFim] = useState<Date | undefined>();
  const [loadingDisp, setLoadingDisp] = useState(false);
  const [armarios, setArmarios] = useState<Armario[]>([]);
  const [praiasList, setPraiasList] = useState<Praia[]>([]);
  const [loadingPraias, setLoadingPraias] = useState(true);

  // Fluxo de aluguel (modal)
  const [abrirAlugar, setAbrirAlugar] = useState(false);
  const [alugandoArmario, setAlugandoArmario] = useState<Armario | null>(null);
  const [criandoAluguel, setCriandoAluguel] = useState(false);

  // Encerrar aluguel
  const [encerrarId, setEncerrarId] = useState<string>("");
  const [dataFimReal, setDataFimReal] = useState<string>("");
  const [encerrando, setEncerrando] = useState(false);
  const [resumoEncerramento, setResumoEncerramento] = useState<any>(null);
  const [armariosOcupadosList, setArmariosOcupadosList] = useState<ArmarioOcupado[]>([]);
  const [loadingOcupados, setLoadingOcupados] = useState(false);

  // Pagamentos
  const [loadingPg, setLoadingPg] = useState(false);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [abrirPagamento, setAbrirPagamento] = useState(false);
  const [salvandoPg, setSalvandoPg] = useState(false);

  const [usuariosList, setUsuariosList] = useState<UsuarioResumo[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [pagamentoUsuarioId, setPagamentoUsuarioId] = useState<string>("");

  // Relatórios
  const [devedores, setDevedores] = useState<Devedor[]>([]);
  const [loadingDev, setLoadingDev] = useState(false);

  useEffect(() => {
    // Função para carregar dados iniciais (lista de praias)
    async function carregarDadosIniciais() {
      setLoadingPraias(true);
      try {
        const data = await fetchJSON(`${API_BASE}/praias`);
        setPraiasList(data as Praia[]);
      } catch (err: any) {
        toast.error("Erro ao carregar lista de praias", { description: err?.message });
      } finally {
        setLoadingPraias(false);
      }
    }
    // Carrega outras coisas se 'activeTab' mudar
    if (activeTab === "pagamentos") {
      carregarPagamentos();
      carregarUsuarios(); //
    }

    if (activeTab === "devedores") {
      carregarDevedores(); // Carrega os devedores automaticamente
    }

    // Roda a função de carregar praias (apenas uma vez)
    if (praiasList.length === 0) {
      carregarDadosIniciais();
    }

    if (activeTab === "aluguéis") {
      // Carrega a lista de armários para o dropdown de encerramento
      carregarArmariosOcupados();
    }

    if (praiasList.length === 0) {
      carregarDadosIniciais();
    }

  }, [activeTab]);

  // ---------------- BUSCA DISPONIBILIDADE ----------------
  async function onBuscarDisponibilidade(e: FormEvent) {
    e.preventDefault();
    setLoadingDisp(true);

    try {
      const params = new URLSearchParams();
      // CORREÇÃO: Adicionado '&& praiaNome !== "all"'
      if (praiaNome && praiaNome !== "all") params.set("praia", praiaNome);
      if (tamanho && tamanho !== "all") params.set("tamanho", tamanho);
      if (status && status !== "all") params.set("status", status);
      if (inicio) params.set("inicio", inicio.toISOString());
      if (fim) params.set("fim", fim.toISOString());

      const url = `${API_BASE}/armarios/disponibilidade?${params.toString()}`;
      const data = await fetchJSON(url);
      setArmarios(data as Armario[]);
    } catch (err: any) {
      toast.error("Erro ao buscar disponibilidade", {
        description: err?.message ?? "Tente novamente.",
      });
    } finally {
      setLoadingDisp(false);
    }
  }

  // ---------------- ABRIR MODAL ALUGAR ----------------
  function abrirFluxoAluguel(a: Armario) {
    setAlugandoArmario(a);
    setAbrirAlugar(true);
  }

  // ---------------- CRIAR ALUGUEL ----------------
  async function criarAluguel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!alugandoArmario) return toast.warning("Selecione um armário primeiro.");

    const form = new FormData(e.currentTarget);
    const payload = {
      usuario_id: Number(form.get("usuario_id")),
      armario_id: alugandoArmario.armario_id,
      data_inicio: String(form.get("data_inicio")),
      data_fim_prevista: String(form.get("data_fim_prevista")),
    };

    setCriandoAluguel(true);
    try {
      const data = await fetchJSON(`${API_BASE}/alugueis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("Aluguel criado", { description: `ID #${data.id}` });
      setAbrirAlugar(false);
      // re-buscar disponibilidade com os filtros atuais
      const fakeEvt = { preventDefault: () => { } } as unknown as FormEvent;
      await onBuscarDisponibilidade(fakeEvt);
    } catch (err: any) {
      toast.error("Erro ao criar aluguel", { description: err?.message ?? "Tente novamente." });
    } finally {
      setCriandoAluguel(false);
    }
  }

  // ---------------- ENCERRAR ALUGUEL ----------------
  async function encerrarAluguel(e: FormEvent) {
    e.preventDefault();
    if (!encerrarId || !dataFimReal) {
      // Mensagem de validação atualizada
      return toast.warning("Preencha os campos", { description: "Informe o Código do Armário e data/hora de término." });
    }
    setEncerrando(true);
    setResumoEncerramento(null);
    try {

      const data = await fetchJSON(`${API_BASE}/alugueis/encerrar-por-codigo`, { // 1. Nova Rota
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cod_armario: encerrarId, // 2. Envia o código no body
          data_fim_real: dataFimReal
        }),
      });

      setResumoEncerramento(data);
      toast.success("Aluguel encerrado");
      setEncerrarId(""); // Limpa o estado
      setDataFimReal("");

      carregarArmariosOcupados(); //

    } catch (err: any) {
      toast.error("Erro ao encerrar", { description: err?.message ?? "Confira o código e tente novamente." });
    } finally {
      setEncerrando(false);
    }
  }

  async function carregarArmariosOcupados() {
    setLoadingOcupados(true);
    try {
      const data = await fetchJSON(`${API_BASE}/armarios/ocupados`);
      setArmariosOcupadosList(data as ArmarioOcupado[]);
    } catch (err: any) {
      // Não mostra toast de erro aqui, para não poluir
      // O dropdown simplesmente ficará vazio
      console.error("Erro ao carregar armários ocupados", err);
      setArmariosOcupadosList([]); // Garante que a lista está vazia em caso de erro
    } finally {
      setLoadingOcupados(false);
    }
  }

  // ---------------- CARREGAR PAGAMENTOS ----------------
  async function carregarUsuarios() {
    setLoadingUsuarios(true);
    try {
      const data = await fetchJSON(`${API_BASE}/usuarios`);
      setUsuariosList(data as UsuarioResumo[]);
    } catch (err: any) {
      console.error("Erro ao carregar usuários", err);
    } finally {
      setLoadingUsuarios(false);
    }
  }

  async function carregarPagamentos() {
    setLoadingPg(true);
    try {
      const data = await fetchJSON(`${API_BASE}/pagamentos`);
      setPagamentos(data as Pagamento[]);
    } catch (err: any) {
      toast.error("Erro ao carregar pagamentos", { description: err?.message });
    } finally {
      setLoadingPg(false);
    }
  }

  // ---------------- CRIAR PAGAMENTO ----------------
  async function criarPagamento(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    if (!pagamentoUsuarioId) {
      return toast.warning("Selecione um usuário.");
    }

    const payload = {
      usuario_id: Number(pagamentoUsuarioId), // Pega do estado
      valor: Number(form.get("valor")),
      metodo: String(form.get("metodo")),
      data_pagamento: String(form.get("data_pagamento")),
      alvo: String(form.get("alvo")),
    };

    if (!payload.alvo || !payload.metodo) {
      return toast.warning("Preencha todos os campos do formulário.");
    }

    setSalvandoPg(true);
    try {
      await fetchJSON(`${API_BASE}/pagamentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("Pagamento registrado");
      setAbrirPagamento(false);
      setPagamentoUsuarioId(""); // Limpa o estado do dropdown
      carregarPagamentos(); // Recarrega a tabela
    } catch (err: any) {
      toast.error("Erro ao pagar", { description: err?.message ?? "Tente novamente." });
    } finally {
      setSalvandoPg(false);
    }
  }

  // ---------------- RELATÓRIOS ----------------
  async function carregarDevedores() {
    setLoadingDev(true);
    try {
      const data = await fetchJSON(`${API_BASE}/relatorios/usuarios-devedores`);
      setDevedores(data as Devedor[]);
    } catch (err: any) {
      toast.error("Erro ao buscar devedores", { description: err?.message });
    } finally {
      setLoadingDev(false);
    }
  }

  // ---------------- CSV DISPONIBILIDADE ----------------
  const linhasCSV = useMemo(
    () =>
      armarios.map((a) => ({
        armario_id: a.armario_id,
        codigo: a.cod_armario,
        tamanho: a.tamanho,
        status: a.status,
        praia: a.praia_nome,
        cidade: a.cidade,
      })),
    [armarios]
  );

  // ====================== UI ======================

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-right" />

      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <MobileNav />
            <div className="flex items-center gap-2">
              <img src={logoUrl} alt="Trankaki" className="h-6 w-auto md:h-7" />
              <span className="font-semibold tracking-tight">Trankaki</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar..." />
            </div>
            <Button variant="outline" size="icon" className="md:hidden">
              <Search className="h-4 w-4" />
            </Button>
            
          </div>
        </div>
      </header>

      {/* Layout */}
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="hidden md:block">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-base">Navegação</CardTitle>
              <CardDescription>Escolha uma área</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <SideLink
                label="Disponibilidade"
                icon={<Lock className="h-4 w-4" />}
                active={activeTab === "disponibilidade"}
                onClick={() => setActiveTab("disponibilidade")}
              />
              <SideLink
                label="Aluguéis"
                icon={<Wallet className="h-4 w-4" />}
                active={activeTab === "aluguéis"}
                onClick={() => setActiveTab("aluguéis")}
              />
              <SideLink
                label="Pagamentos"
                icon={<Download className="h-4 w-4" />}
                active={activeTab === "pagamentos"}
                onClick={() => setActiveTab("pagamentos")}
              />
              <SideLink
                label="Devedores"
                icon={<Users2 className="h-4 w-4" />}
                active={activeTab === "devedores"}
                onClick={() => setActiveTab("devedores")}
              />
            </CardContent>
          </Card>
        </aside>

        {/* Conteúdo */}
        <section>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            {/* Tabs para mobile, rolável horizontal */}
            <TabsList className="mb-4 inline-flex w-full gap-2 overflow-x-auto whitespace-nowrap md:hidden">
              <TabsTrigger value="disponibilidade">Disponibilidade</TabsTrigger>
              <TabsTrigger value="aluguéis">Aluguéis</TabsTrigger>
              <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
              <TabsTrigger value="devedores">Devedores</TabsTrigger>
            </TabsList>

            {/* TAB: Disponibilidade */}
            <TabsContent value="disponibilidade">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Buscar armários</CardTitle>
                  <CardDescription>Filtre por praia, tamanho, status e período</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={onBuscarDisponibilidade} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="praia-select">Praia</Label>
                      <Select
                        value={praiaNome}
                        onValueChange={setPraiaNome}
                        disabled={loadingPraias}
                      >
                        <SelectTrigger id="praia-select">
                          <SelectValue placeholder={loadingPraias ? "Carregando praias..." : "Selecione a praia"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as Praias</SelectItem>
                          {praiasList.map((praia) => (
                            <SelectItem key={praia.id} value={praia.nome}>
                              {praia.nome} ({praia.cidade})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Tamanho</Label>
                      <Select
                        value={tamanho}
                        onValueChange={(v) => setTamanho(v as "P" | "M" | "G" | "all")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Qualquer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Qualquer</SelectItem>
                          <SelectItem value="P">P</SelectItem>
                          <SelectItem value="M">M</SelectItem>
                          <SelectItem value="G">G</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select
                        value={status}
                        onValueChange={(v) => setStatus(v as "Disponível" | "Ocupado" | "Manutenção" | "all")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Qualquer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Qualquer</SelectItem>
                          <SelectItem value="Disponível">Disponível</SelectItem>
                          <SelectItem value="Ocupado">Ocupado</SelectItem>
                          <SelectItem value="Manutenção">Manutenção</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <Label>Início</Label>
                      <DateField date={inicio} setDate={setInicio} placeholder="Escolha a data de início" />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <Label>Fim</Label>
                      <DateField date={fim} setDate={setFim} placeholder="Escolha a data de fim" />
                    </div>

                    <div className="sm:col-span-2 lg:col-span-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-muted-foreground">
                        Ajuste os filtros e clique em buscar para ver os armários disponíveis.
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setPraiaNome("");
                            setTamanho("all");
                            setStatus("all");
                            setInicio(undefined);
                            setFim(undefined);
                            setArmarios([]);
                          }}
                        >
                          Limpar
                        </Button>
                        <Button type="submit" disabled={loadingDisp}>
                          {loadingDisp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Buscar
                        </Button>
                      </div>
                    </div>
                  </form>

                  <Separator className="my-6" />

                  {loadingDisp ? (
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : armarios.length === 0 ? (
                    <EmptyState
                      title="Nada por aqui"
                      description="Nenhum armário disponível com os critérios informados."
                    />
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <div className="min-w-[720px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Cód.</TableHead>
                              <TableHead>Tamanho</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Praia</TableHead>
                              <TableHead>Cidade</TableHead>
                              <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {armarios.map((a) => (
                              <TableRow key={a.armario_id}>
                                <TableCell className="font-medium">{a.cod_armario}</TableCell>
                                <TableCell>{a.tamanho}</TableCell>
                                <TableCell><StatusBadge status={a.status} /></TableCell>
                                <TableCell>{a.praia_nome}</TableCell>
                                <TableCell>{a.cidade}</TableCell>
                                <TableCell className="text-right">
                                  <Button size="sm" onClick={() => abrirFluxoAluguel(a)}>
                                    Alugar
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportCSV("armarios_disponibilidade.csv", linhasCSV)}
                      disabled={!linhasCSV.length}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Exportar CSV
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Modal de aluguel */}
              <Dialog open={abrirAlugar} onOpenChange={setAbrirAlugar}>
                <DialogContent className="sm:max-w-[520px]">
                  <DialogHeader>
                    <DialogTitle>Novo aluguel</DialogTitle>
                    <DialogDescription>
                      Confirme os dados para criar o aluguel do armário {alugandoArmario?.cod_armario}.
                    </DialogDescription>
                  </DialogHeader>
                  {alugandoArmario ? (
                    <form onSubmit={criarAluguel} className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Armário</Label>
                          <Input value={alugandoArmario.cod_armario} disabled />
                        </div>
                        <div className="space-y-1">
                          <Label>Usuário (ID)</Label>
                          <Input name="usuario_id" type="number" placeholder="ex.: 1" required />
                        </div>
                        <div className="space-y-1">
                          <Label>Início</Label>
                          <Input name="data_inicio" type="datetime-local" required />
                        </div>
                        <div className="space-y-1">
                          <Label>Fim previsto</Label>
                          <Input name="data_fim_prevista" type="datetime-local" required />
                        </div>
                      </div>
                      <DialogFooter className="flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setAbrirAlugar(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={criandoAluguel}>
                          {criandoAluguel && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Confirmar
                        </Button>
                      </DialogFooter>
                    </form>
                  ) : null}
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* TAB: Aluguéis */}
            <TabsContent value="aluguéis">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Encerrar aluguel */}
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>Encerrar aluguel</CardTitle>
                    <CardDescription>Informe o ID e a data/hora de término</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={encerrarAluguel} className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                      {/* CAMPO 1: O Dropdown (que usa string) */}
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="cod_armario_select">Armário Ocupado</Label>
                        <Select
                          value={encerrarId} // 'encerrarId' é uma string
                          onValueChange={setEncerrarId} // Passa a string direto
                          disabled={loadingOcupados}
                        >
                          <SelectTrigger id="cod_armario_select">
                            <SelectValue placeholder={loadingOcupados ? "Carregando..." : "Selecione o armário"} />
                          </SelectTrigger>
                          <SelectContent>
                            {armariosOcupadosList.length === 0 && !loadingOcupados ? (
                              <SelectItem value="none" disabled>Nenhum armário ocupado</SelectItem>
                            ) : (
                              armariosOcupadosList.map((armario) => (
                                <SelectItem key={armario.cod_armario} value={String(armario.cod_armario)}>
                                  {armario.cod_armario} ({armario.praia_nome})
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* CAMPO 2: A Data*/}
                      <div className="space-y-1 sm:col-span-2">
                        <Label>Data/hora final</Label>
                        <Input
                          type="datetime-local"
                          value={dataFimReal}
                          onChange={(e) => setDataFimReal(e.target.value)}
                          required
                        />
                      </div>

                      {/* Botões */}
                      <div className="sm:col-span-2 flex flex-wrap justify-end gap-2">
                        <Button variant="outline" type="button" onClick={() => {
                          setEncerrarId("");
                          setDataFimReal("");
                          setResumoEncerramento(null);
                          carregarArmariosOcupados();
                        }}>
                          Limpar
                        </Button>
                        <Button type="submit" disabled={encerrando}>
                          {encerrando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Encerrar
                        </Button>
                      </div>
                    </form>

                    <Separator className="my-4" />

                    {!resumoEncerramento ? (
                      <EmptyState
                        title="Sem resumo"
                        description="O resumo do encerramento aparecerá aqui."
                      />
                    ) : (
                      // Este JSX sabe ler a resposta { aluguel: {...}, multa: {...} }
                      <div className="text-sm space-y-1">
                        <div className="font-medium">Resumo do Encerramento:</div>

                        {/* Lê resumoEncerramento.aluguel.id */}
                        <div><b>Aluguel ID:</b> #{resumoEncerramento.aluguel.id}</div>
                        <div><b>Armário ID:</b> {resumoEncerramento.aluguel.armario_id}</div>

                        {/* Mostra a mudança de status */}
                        <div className="flex items-center gap-1.5">
                          <b>Status:</b>
                          <StatusBadge status="Ocupado" />
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <StatusBadge status="Disponível" />
                        </div>

                        {/* Lê resumoEncerramento.aluguel.valor_final */}
                        <div><b>Valor Final:</b> {fmtBRL(resumoEncerramento.aluguel.valor_final)}</div>

                        {/* Verifica se existe um objeto 'multa' */}
                        {resumoEncerramento.multa && (
                          <div className="!mt-2 pt-2 border-t">
                            <div className="font-medium text-destructive">Multa Gerada (Atraso)</div>
                            <div><b>ID da Multa:</b> #{resumoEncerramento.multa.id}</div>
                            <div><b>Valor da Multa:</b> {fmtBRL(resumoEncerramento.multa.valor)}</div>
                            <div><b>Status Pagamento:</b> <StatusBadge status="Manutenção" /></div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Dica/Atalhos */}
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>Dicas</CardTitle>
                    <CardDescription>Boas práticas do fluxo</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Encerrar o aluguel gera o cálculo de valores e multa (se houver).</p>
                    <p>Use a aba Pagamentos para registrar a quitação.</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TAB: Pagamentos */}
            <TabsContent value="pagamentos">
              <div className="space-y-6">
                {/* Criar pagamento */}
                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Novo pagamento</CardTitle>
                      <CardDescription>Registre um pagamento de aluguel ou multa</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Dialog open={abrirPagamento} onOpenChange={setAbrirPagamento}>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Novo pagamento</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={criarPagamento} className="grid grid-cols-1 gap-3 md:grid-cols-2">

                          {/* CAMPO 1: Dropdown de Usuário */}
                          <div className="md:col-span-2">
                            <Label>Usuário</Label>
                            <Select
                              value={pagamentoUsuarioId}
                              onValueChange={setPagamentoUsuarioId}
                              disabled={loadingUsuarios}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={loadingUsuarios ? "Carregando..." : "Selecione o usuário"} />
                              </SelectTrigger>
                              <SelectContent>
                                {usuariosList.map((user) => (
                                  <SelectItem key={user.id} value={String(user.id)}>
                                    {user.nome} (CPF: ...{user.cpf?.slice(-4)})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* CAMPO 2: Valor */}
                          <div>
                            <Label>Valor (R$)</Label>
                            <Input name="valor" type="number" step="0.01" required />
                          </div>

                          {/* CAMPO 3: Data */}
                          <div>
                            <Label>Data do pagamento</Label>
                            <Input type="datetime-local" name="data_pagamento" required />
                          </div>

                          {/* CAMPO 4: Alvo (Multa ou Aluguel) */}
                          <div>
                            <Label>Alvo</Label>
                            <Select name="alvo" required>
                              <SelectTrigger><SelectValue placeholder="aluguel ou multa" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="aluguel">Aluguel</SelectItem>
                                <SelectItem value="multa">Multa</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* CAMPO 5: Método */}
                          <div>
                            <Label>Método</Label>
                            <Select name="metodo" required>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pix">PIX</SelectItem>
                                <SelectItem value="cartao">Cartão</SelectItem>
                                <SelectItem value="boleto">Boleto</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* CAMPO 'ID DO ALVO' FOI REMOVIDO */}

                          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => {
                              setAbrirPagamento(false);
                              setPagamentoUsuarioId("");
                            }}>Cancelar</Button>
                            <Button type="submit" disabled={salvandoPg}>
                              {salvandoPg && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Registrar
                            </Button>
                          </div>
                        </form>
                      </DialogContent>

                      {/* O Botão que abre o modal */}
                      <Button variant="outline" size="sm" onClick={() => setAbrirPagamento(true)}>Novo pagamento</Button>
                    </Dialog>
                  </CardContent>
                </Card>

                {/* Lista de pagamentos */}
                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Pagamentos</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={carregarPagamentos}>Recarregar</Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          exportCSV(
                            "pagamentos.csv",
                            pagamentos.map((p) => ({
                              id: p.id,
                              usuario_id: p.usuario_id,
                              alvo: p.alvo,
                              alvo_id: p.alvo_id,
                              metodo: p.metodo,
                              valor: p.valor,
                              data: p.data,
                            }))
                          )
                        }
                        disabled={!pagamentos.length}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Exportar CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingPg ? (
                      <div className="space-y-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : !pagamentos.length ? (
                      <EmptyState title="Sem pagamentos" description="Nenhum pagamento cadastrado." />
                    ) : (
                      <div className="rounded-md border overflow-x-auto">
                        <div className="min-w-[720px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Usuário</TableHead>
                                <TableHead>Alvo</TableHead>
                                <TableHead>Método</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead>Data</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pagamentos.map((p) => (
                                <TableRow key={p.id}>
                                  <TableCell>#{p.id}</TableCell>
                                  <TableCell>{p.usuario_id}</TableCell>
                                  <TableCell>{p.alvo} #{p.alvo_id}</TableCell>
                                  <TableCell className="uppercase">{p.metodo}</TableCell>
                                  <TableCell>{fmtBRL(p.valor)}</TableCell>
                                  <TableCell>{new Date(p.data).toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TAB: Devedores */}
            <TabsContent value="devedores">
              <div className="space-y-3">
                {/* Relatório: Devedores */}
                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Usuários devedores</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportCSV("devedores.csv", devedores)}
                        disabled={!devedores.length}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Exportar CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingDev ? (
                      <div className="space-y-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : devedores.length ? (
                      <div className="rounded-md border overflow-x-auto">
                        <div className="min-w-[520px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {/* 1. Adicionámos a coluna ID Usuário */}
                                <TableHead className="w-[100px]">ID Usuário</TableHead>
                                {/* 2. A coluna 'Usuário' agora é 'Nome' */}
                                <TableHead>Nome</TableHead>
                                <TableHead>Total em aberto</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {devedores.map((d: any, i: number) => (
                                <TableRow key={d.usuario_id ?? i}>
                                  {/* 3. Adicionámos a célula para o ID */}
                                  <TableCell className="font-medium">{d.usuario_id}</TableCell>
                                  {/* 4. A célula 'Nome' agora só mostra o nome */}
                                  <TableCell>{d.nome}</TableCell>
                                  <TableCell>{fmtBRL(Number(d.total_em_aberto))}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : (
                      <EmptyState title="Sem dados" description="Carregue para ver usuários devedores." />
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </main>

      {/* Footer */}
      <footer className="mx-auto mt-8 max-w-7xl px-4 pb-10 pt-4 text-sm text-muted-foreground">
        <Separator className="mb-4" />
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} Trankaki</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2"><Users2 className="h-4 w-4" /> Equipe Trankaki</div>
            <div className="flex items-center gap-2"><BookIcon className="h-4 w-4" /> BD II - Profº Leo</div>
          </div>
        </div>
      </footer>
    </div >
  );
}

// ====================== COMPONENTES AUXILIARES ======================
function SideLink({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-primary/10 text-primary" : "hover:bg-muted"
        }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <Button variant="outline" size="icon" onClick={() => setOpen((o) => !o)}>
        <ArrowRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
      </Button>
      {open && (
        <div className="absolute left-4 z-40 mt-2 w-[240px] rounded-md border bg-background p-2 shadow">
          <div className="space-y-1">
            <SideLink label="Disponibilidade" icon={<Lock className="h-4 w-4" />} onClick={() => (location.hash = "#disponibilidade")} />
            <SideLink label="Aluguéis" icon={<Wallet className="h-4 w-4" />} onClick={() => (location.hash = "#aluguéis")} />
            <SideLink label="Pagamentos" icon={<Download className="h-4 w-4" />} onClick={() => (location.hash = "#pagamentos")} />
            <SideLink label="Devedores" icon={<Users2 className="h-4 w-4" />} onClick={() => (location.hash = "#devedores")} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Armario["status"] }) {
  const variant =
    status === "Disponível"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200"
      : status === "Ocupado"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
        : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${variant}`}>{status}</span>;
}

function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-start justify-center gap-1 rounded-md border p-6">
      <div className="text-base font-medium">{title}</div>
      {description && <div className="text-sm text-muted-foreground">{description}</div>}
    </div>
  );
}

function DateField({
  date,
  setDate,
  placeholder,
}: {
  date?: Date;
  setDate: (d?: Date) => void;
  placeholder?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-left font-normal">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? date.toLocaleDateString() : (placeholder ?? "Escolha a data")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
      </PopoverContent>
    </Popover>
  );
}
