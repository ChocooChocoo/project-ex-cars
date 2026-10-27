import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "GCE",
  version: packageJson.version,
  copyright: `© ${currentYear}, GCE Auto Sales.`,
  meta: {
    title: "GCE — Global Car Exchange",
    description:
      "Global Car Exchange (GCE): buy, sell and finance used cars in CALABARZON, with GCE visits, meet-ups and delivery.",
  },
};
