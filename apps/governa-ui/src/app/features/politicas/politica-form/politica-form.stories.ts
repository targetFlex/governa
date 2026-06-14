// ============================================================
// politica-form.stories.ts — Storybook 8 + Axe
// ============================================================

import type { Meta, StoryObj } from '@storybook/angular';
import { PoliticaFormComponent } from './politica-form.component';

const meta: Meta<PoliticaFormComponent> = {
  title:     'Features/Politicas/PoliticaForm',
  component: PoliticaFormComponent,
};
export default meta;
type Story = StoryObj<PoliticaFormComponent>;

export const NivelConsultivo: Story = {
  name: 'Nível: Somente Consulta',
};

export const NivelAssistido: Story = {
  name: 'Nível: Com Aprovação (ASSISTIDO)',
};

export const NivelAutonomo: Story = {
  name: 'Nível: Ação Direta (AUTÔNOMO)',
};

export const EstadoCarregando: Story = {
  name: 'Estado: Carregando (skeleton)',
};

export const EstadoErro: Story = {
  name: 'Estado: Erro de carga',
};

export const EstadoSucesso: Story = {
  name: 'Estado: Salvo com sucesso',
};
