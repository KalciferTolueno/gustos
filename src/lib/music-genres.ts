const genreAliases: Array<[canonical: string, aliases: string[]]> = [
  ["Acid", ["acid"]],
  ["Bachata", ["bachata"]],
  ["Cumbia", ["cumbia"]],
  ["Cueca", ["cueca", "cueca brava"]],
  ["Dancehall", ["dancehall"]],
  ["Electrónica", ["electronica", "musica electronica"]],
  ["Folclore", ["folclore", "folklore", "musica chilena"]],
  ["Hip hop", ["hip hop"]],
  ["House", ["house music", "house"]],
  ["K-pop", ["k pop", "kpop"]],
  ["Merengue", ["merengue"]],
  ["Metal", ["heavy metal", "metal"]],
  ["Pop", ["pop"]],
  ["Pop latino", ["pop latino"]],
  ["Punk", ["punk"]],
  ["R&B", ["r b", "rhythm and blues"]],
  ["Rap", ["rap"]],
  ["Reggae", ["reggae"]],
  ["Reguetón", ["reggaeton", "regueton"]],
  ["Rock", ["rock"]],
  ["Salsa", ["salsa"]],
  ["Soul", ["soul"]],
  ["Techno", ["techno"]],
  ["Trance", ["trance"]],
  ["Trap", ["trap"]],
  ["Tropical", ["tropical", "musica tropical"]],
  ["Urbano", ["urbano", "musica urbana", "cultura urbana"]],
];

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL").replace(/[^a-z0-9]+/g, " ").trim();
}

export function musicGenresFromLabels(labels: string[]) {
  const genres: string[] = [];
  for (const label of labels) {
    const value = ` ${normalized(label)} `;
    for (const [canonical, aliases] of genreAliases) {
      if (aliases.some((alias) => value.includes(` ${normalized(alias)} `)) && !genres.includes(canonical)) genres.push(canonical);
    }
  }
  const explicitPop = labels.some((label) => normalized(label) === "pop");
  return genres.filter((genre) => genre !== "Pop" || explicitPop || (!genres.includes("K-pop") && !genres.includes("Pop latino")));
}
