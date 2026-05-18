import { PrismaClient, AutonomyLevel, AgentStatus, Plan } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  console.log('Seeding...')
  const tenant = await prisma.tenant.upsert({
    where:  { slug: 'target-flex-dev' },
    update: {},
    create: { name: 'Target Flex Patrimonial (Dev)', slug: 'target-flex-dev', plan: Plan.STARTER },
  })
  console.log(`✓ Tenant: ${tenant.name}`)
  const policy = await prisma.policy.upsert({
    where:  { id: 'policy-atendimento-consultivo' },
    update: {},
    create: {
      id: 'policy-atendimento-consultivo', tenantId: tenant.id,
      name: 'Atendimento — Consultivo', autonomyLevel: AutonomyLevel.CONSULTIVO,
      allowedActions: ['read_protheus_pedido','read_protheus_cliente','read_politica_atendimento'],
      approvers: [], version: '1.0.0',
    },
  })
  console.log(`✓ Política: ${policy.name}`)
  const agent = await prisma.agent.upsert({
    where:  { id: 'agent-atendimento-v1' },
    update: {},
    create: {
      id: 'agent-atendimento-v1', tenantId: tenant.id,
      name: 'Atendimento Protheus v1',
      description: 'Agente consultivo de atendimento integrado ao Protheus',
      ownerId: 'fabio-gomes', policyId: policy.id,
      status: AgentStatus.SANDBOX, modelId: 'claude-sonnet-4-6',
      tools: ['read_protheus_pedido','read_protheus_cliente','read_politica_atendimento'],
    },
  })
  console.log(`✓ Agente: ${agent.name}`)
  console.log('\nSeed concluído.')
}
main().catch(console.error).finally(() => prisma.$disconnect())
