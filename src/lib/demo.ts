import type { Role } from "./types";

export const DEMO_PASSWORD = "sede123";

export const DEMO_ACCOUNTS: {
  email: string;
  password: string;
  name: string;
  role: Role;
  blurb: string;
}[] = [
  {
    email: "rh@sede.local",
    password: DEMO_PASSWORD,
    name: "Ana Ribeiro",
    role: "RH",
    blurb: "Conduz a integração e compartilha a tela.",
  },
  {
    email: "novo@sede.local",
    password: DEMO_PASSWORD,
    name: "Bruno Costa",
    role: "NOVO",
    blurb: "Entra na sala de integração. Não vê o canal interno do RH.",
  },
  {
    email: "colab@sede.local",
    password: DEMO_PASSWORD,
    name: "Carla Mendes",
    role: "COLABORADOR",
    blurb: "Só vê o #geral. Sem acesso à integração.",
  },
  {
    email: "admin@sede.local",
    password: DEMO_PASSWORD,
    name: "Tiago Alves",
    role: "ADMIN",
    blurb: "Vê todos os canais.",
  },
];
