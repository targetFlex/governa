// ============================================================
// pedido.mapper.ts — Conversão ProtheusPedidoRaw → PedidoInterno
//
// SRP: apenas mapeamento de campos. Nenhuma validação de schema
//      e nenhuma lógica HTTP vivem aqui.
// ============================================================

import {
  ItemPedido,
  ItemPedidoRaw,
  PedidoInterno,
  ProtheusPedidoRaw,
  STATUS_MAP,
} from './pedido.schema'

export class PedidoMapper {
  /**
   * Converte um pedido raw (já validado pelo Zod) para o modelo interno.
   * `C5_EMISSAO` no formato YYYYMMDD → Date UTC (meia-noite).
   */
  toInterno(raw: ProtheusPedidoRaw): PedidoInterno {
    return {
      numeroPedido: raw.C5_NUM,
      clienteId:    raw.C5_CLIENTE,
      loja:         raw.C5_LOJA,
      dataEmissao:  this.parseEmissao(raw.C5_EMISSAO),
      valorTotal:   raw.C5_VALOR,
      status:       STATUS_MAP[raw.C5_STATUS],
      itens:        raw.C5_ITENS.map((i: ItemPedidoRaw) => this.mapItem(i)),
    }
  }

  private parseEmissao(yyyymmdd: string): Date {
    // YYYYMMDD → "YYYY-MM-DD" → Date UTC
    const iso = `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
    return new Date(`${iso}T00:00:00.000Z`)
  }

  private mapItem(item: ItemPedidoRaw): ItemPedido {
    return {
      codigoProduto: item.D2_COD,
      quantidade:    item.D2_QUANT,
      precoUnitario: item.D2_PRCVEN,
    }
  }
}
