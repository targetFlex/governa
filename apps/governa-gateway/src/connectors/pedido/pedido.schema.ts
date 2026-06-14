// ============================================================
// pedido.schema.ts — Schema Zod + interfaces do domínio pedido
//
// Fonte de verdade para:
//   - Validação da resposta raw do Protheus (ProtheusPedidoSchema)
//   - Contrato interno de saída do conector (PedidoInterno)
//
// SRP: este módulo NÃO contém lógica de mapeamento nem de I/O.
// ============================================================

import { z } from 'zod'

// ── Schema da resposta raw do Protheus ──────────────────────

export const ItemPedidoSchema = z.object({
  D2_COD:    z.string(),
  D2_QUANT:  z.number(),
  D2_PRCVEN: z.number(),
})

export const ProtheusPedidoSchema = z.object({
  C5_NUM:     z.string(),
  C5_CLIENTE: z.string(),
  C5_LOJA:    z.string(),
  C5_EMISSAO: z.string().regex(/^\d{8}$/, 'C5_EMISSAO deve ser YYYYMMDD (8 dígitos)'),
  C5_VALOR:   z.number(),
  C5_STATUS:  z.enum(['A', 'B', 'E', 'L'], {
    errorMap: () => ({ message: "C5_STATUS deve ser 'A' | 'B' | 'E' | 'L'" }),
  }),
  C5_ITENS:   z.array(ItemPedidoSchema),
})

export type ProtheusPedidoRaw = z.infer<typeof ProtheusPedidoSchema>
export type ItemPedidoRaw     = z.infer<typeof ItemPedidoSchema>

// ── Modelo interno — independente da estrutura TOTVS ────────

export type StatusPedido = 'ABERTO' | 'BLOQUEADO' | 'ENCERRADO' | 'LIBERADO'

export interface ItemPedido {
  codigoProduto: string
  quantidade:    number
  precoUnitario: number
}

export interface PedidoInterno {
  numeroPedido: string
  clienteId:    string
  loja:         string
  dataEmissao:  Date
  valorTotal:   number
  status:       StatusPedido
  itens:        ItemPedido[]
}

// ── Mapa de status Protheus → domínio interno ────────────────

export const STATUS_MAP: Record<string, StatusPedido> = {
  A: 'ABERTO',
  B: 'BLOQUEADO',
  E: 'ENCERRADO',
  L: 'LIBERADO',
}
