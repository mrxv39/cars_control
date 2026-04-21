import type { Lang } from "./lang_detect.ts";

export interface FewShot {
  lang: Lang;
  lead_msg: string;
  ricard_reply: string;
}

// 6 pares reales extraídos de _leads_analysis_2026-04-21/pairs_v2.json.
// Limpieza mínima: quitar el "El <fecha>, HH:MM, <Nombre> &lt;" que aparecía
// al final de algunos (es basura del quote del email original).
export const FEW_SHOTS: FewShot[] = [
  {
    lang: "ca",
    lead_msg: "Me interesa este vehículo",
    ricard_reply:
      "Bona tarda Francesc !!\nSoc Ricard de CodinaCars, Em podries facilitar el teu telèfon porfa!!\nAixi puc trucarte i explicarte millor! Per si vols escriurem, et deixo el meu numero 646131565\nSalutacions",
  },
  {
    lang: "es",
    lead_msg: "Hola. El precio es negociable?",
    ricard_reply:
      "Buenas Hugo! Disculpa, este vehiculo lo tengo reservado y si no falla nada, le daran la financiación,\nEn caso contrario te aviso rápido,\nSi quieres tengo otra unidad de T Cross en Manual,\nEn caso de querer solo automático, tengo un polo R line y un Mazda cx3,\nSi estas interesado puedes contactarme al 646131565, o dejarme tu teléfono!",
  },
  {
    lang: "es",
    lead_msg: "Me interesa este vehículo",
    ricard_reply:
      "Buenas Dario! Soy Ricard de CodinaCars, El vehiculo esta reservado condicionado a que le den la financiación, si se la rechazan seras al primero que avise Dario",
  },
  {
    lang: "es",
    lead_msg: "Buscaba algo más compacto la verdad",
    ricard_reply:
      "entiendo, supongo que los volkswagen polo, ibiza, t-cross, no te acaban de convencer, hacemos eso si quieres, y te aviso al proximo que entre en stock, espero que pronto",
  },
  {
    lang: "es",
    lead_msg:
      "Estoy buscando vender mi Volkswagen Passat Alltrack 2017. Fue importado del Reino Unido, por lo que tiene la rueda en el lado opuesto. Ha pasado la ITV. ¿Podría cambiar ese coche por el T-Cross?",
    ricard_reply:
      "Buenas Sharon, me sabe mal pero tenemos el t cross dsg reservado, pendiente que aprueben la financiacion,",
  },
  {
    lang: "es",
    lead_msg: "Hola buenas que necesito para financiar",
    ricard_reply:
      "Buenos dias Camilo, soy Ricard de Codinacars, ahora te contacto por whatsapp y te informo bien de lo que necesitaria para financiar, un saludo",
  },
];
