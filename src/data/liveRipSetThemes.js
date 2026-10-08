/** Textos por coleção (PT/EN). Informativos, sem fórmula. */

function normalizeThemeKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[“”"]/g, '')
    .replace(/[:：]/g, '')
    .replace(/[./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const THEMES = Object.create(null)

function addTheme(pt, en, keys) {
  const value = { 'pt-BR': pt, en }
  for (const key of keys) {
    const normalized = normalizeThemeKey(key)
    if (normalized) THEMES[normalized] = value
  }
}

addTheme(
  'Booster extra do arco de Elbaf, a ilha dos gigantes. Traz Loki, Dorry, Brogy e os outros guerreiros mais fortes do Novo Mundo.',
  'Extra booster for the Elbaf arc, the island of giants. It features Loki, Dorry, Brogy, and the other strongest warriors of the New World.',
  ['THE WORLD’S STRONGEST WARRIORS', "THE WORLD'S STRONGEST WARRIORS", '世界最強の戦士', 'EB04', 'one-piece:EB04']
)
addTheme(
  'Booster de Egghead centrado no passado de Bartholomew Kuma. Mostra quem herda a vontade de outras pessoas, com os revolucionários e o fechamento da ilha científica.',
  'Egghead booster centered on Bartholomew Kuma’s past. It follows those who inherit someone else’s will, with the Revolutionaries and the close of the science island.',
  ['CARRYING ON HIS WILL', 'OP13', 'one-piece:OP13']
)
addTheme(
  'Os Yonkou no Novo Mundo depois de Wano. Blackbeard, as grandes potências e o rearranjo das forças no mar.',
  'The Emperors in the New World after Wano. Blackbeard, the great powers, and the reshuffle of force at sea.',
  ['Emperors In The New World', 'Emperors in the New World', 'OP09', 'one-piece:OP09']
)
addTheme(
  'Desfecho de Wano, com Luffy despertando o Gear 5. É o set da virada de era no jogo.',
  'The end of Wano, with Luffy awakening Gear 5. The set where the era turns in the game.',
  ['Awakening Of The New Era', 'Awakening Of The New Era EN']
)
addTheme(
  'Booster do confronto decisivo no Novo Mundo. Foca o momento em que as tripulações largam a preparação e entram na batalha.',
  'Booster for the decisive clash in the New World. It focuses on the moment crews leave preparation behind and enter battle.',
  ['THE TIME OF BATTLE', 'OP16', 'one-piece:OP16']
)
addTheme(
  'Arco de Skypiea: a ilha no céu, Eneru no trono e os chapéus de palha na Terra dos Deuses.',
  'Skypiea arc: the sky island, Enel on the throne, and the Straw Hats on the land of the gods.',
  ["Adventure on KAMI’s Island", "Adventure on KAMI's Island", 'OP15', 'one-piece:OP15']
)
addTheme(
  'Ohara, o Século Vazio e Nico Robin. O set olha para o futuro que só existe 500 anos depois da destruição da ilha dos arqueólogos.',
  'Ohara, the Void Century, and Nico Robin. The set looks toward the future that only exists 500 years after the archaeologists’ island was destroyed.',
  ['The Future After 500 years', 'OP07']
)
addTheme(
  'Enies Lobby no auge: Rob Lucci, Sogeking e o resgate de Robin. Também traz a tripulação no ataque ao tribunal da Justiça.',
  'Enies Lobby at its peak: Rob Lucci, Sogeking, and Robin’s rescue. It also covers the crew’s assault on the court of Justice.',
  ['A Fist of Divine Speed', 'OP11']
)
addTheme(
  'Gol D. Roger e Edward Newgate no mesmo set. Duas lendas do mar, com as tripulações e o contexto da era dos piratas.',
  'Gol D. Roger and Edward Newgate in the same set. Two legends of the sea, with their crews and the pirate-era backdrop.',
  ['Two Legends', 'OP08', 'one-piece:OP08']
)
addTheme(
  'Parque Arlong e o East Blue: Nami, os homens-peixe e a tripulação de Arlong na costa que Luffy libertou.',
  'Arlong Park and East Blue: Nami, the fish-men, and Arlong’s crew on the coast Luffy freed.',
  ["THE AZURE SEA'S SEVEN", 'THE AZURE SEAS SEVEN', 'OP14']
)
addTheme(
  'Família Vinsmoke, Germa 66 e a origem de Sanji. Whole Cake Island pelo lado do sangue real e da ciência de batalha.',
  'The Vinsmoke family, Germa 66, and Sanji’s origin. Whole Cake Island from the side of royal blood and battle science.',
  ['Royal Blood', 'OP10', 'one-piece:OP10']
)
addTheme(
  'O começo da jornada em East Blue. Luffy, o chapéu de palha e os primeiros membros da tripulação.',
  'The start of the journey in East Blue. Luffy, the straw hat, and the first members of the crew.',
  ['Romance Dawn', 'ROMANCE DAWN', 'OP01', 'one-piece:OP01']
)
addTheme(
  'O legado de Bartholomew Kuma e dos revolucionários. Foca quem ensinou a geração seguinte, incluindo Bonney.',
  'The legacy of Bartholomew Kuma and the Revolutionaries. It focuses on those who taught the next generation, including Bonney.',
  ['Legacy of the Master', 'OP12']
)
addTheme(
  'Guerra de Marineford: Ace, Barba Branca e o quartel da Marinha. O set cobre o confronto que mudou o Novo Mundo.',
  'The Marineford War: Ace, Whitebeard, and Navy HQ. The set covers the clash that changed the New World.',
  ['Paramount War', 'OP02', 'one-piece:OP02']
)
addTheme(
  'Dressrosa e as intrigas de Doflamingo. Coliseu, brinquedos e o reino que só se sustenta na mentira.',
  'Dressrosa and Doflamingo’s intrigues. The coliseum, the toys, and the kingdom that only holds together as a lie.',
  ['The Kingdoms Of Intrigue', 'OP04']
)
addTheme(
  'Começo de Wano, com Kid, Law e os supernovas. É o set em que a aliança contra Kaido começa a se formar.',
  'The start of Wano, with Kid, Law, and the Supernovas. The set where the alliance against Kaido starts to form.',
  ['Pillars Of Strength', 'OP03', 'one-piece:OP03']
)
addTheme(
  'Compilado especial das cartas mais marcantes de One Piece, em edição com storage box.',
  'A special compilation of the most notable One Piece cards, in a storage-box edition.',
  ['One Piece Card The Best Storage Box Set Bonus Pack']
)

addTheme(
  'Expansão MEGA pelos 30 anos de Pokémon. Reúne Pikachu, Mega Evoluções e vários clássicos da franquia.',
  'A MEGA expansion for Pokémon’s 30th anniversary. It brings together Pikachu, Mega Evolutions, and several franchise classics.',
  ['30th CELEBRATION', 'M6A', 'pokemon-standard:M6A']
)
addTheme(
  'High Class da linha MEGA, focado em Mega Evoluções e nas artes mais raras do bloco.',
  'A MEGA-line High Class focused on Mega Evolutions and the rarer arts of the block.',
  ['MEGA Dream ex', 'M2A', 'pokemon-standard:M2A']
)
addTheme(
  'High Class do festival Terastal de Paldea. Destaca as formas cristalizadas e as artes especiais do fenômeno.',
  'A High Class for Paldea’s Terastal festival. It highlights crystalized forms and special arts of the phenomenon.',
  ['Terastal Festival ex', 'SV8A', 'pokemon-standard:SV8A']
)
addTheme(
  'Enhanced Expansion com os 151 Pokémon originais de Kanto, do Bulbasaur ao Mew.',
  'An Enhanced Expansion with the original 151 Kanto Pokémon, from Bulbasaur to Mew.',
  ['pokemon card 151', '151', 'SV2A', 'pokemon-standard:SV2A']
)
addTheme(
  'Expansão MEGA de fogo, liderada pela Mega Charizard X.',
  'A fire MEGA expansion, led by Mega Charizard X.',
  ['Inferno X', 'M2', 'pokemon-standard:M2']
)
addTheme(
  'Expansão MEGA da tempestade esmeralda, com a Mega Rayquaza no centro.',
  'An emerald-storm MEGA expansion, with Mega Rayquaza at the center.',
  ['Storm Emeralda', 'M6', 'pokemon-standard:M6']
)
addTheme(
  'High Class de Pokémon shiny da era Paldea, com muitas artes secretas e variantes brilhantes.',
  'A High Class of Paldea-era shiny Pokémon, with many secret arts and shiny variants.',
  ['Shiny Treasure ex', 'SV4A', 'pokemon-standard:SV4A']
)
addTheme(
  'Expansão MEGA do abismo, liderada pela Mega Gyarados.',
  'An abyss MEGA expansion, led by Mega Gyarados.',
  ['Abyss Eye', 'M5', 'pokemon-standard:M5']
)
addTheme(
  'High Class que reúne as principais cartas VSTAR de Espada e Escudo.',
  'A High Class collecting the main VSTAR cards from Sword & Shield.',
  ['VSTAR Universe']
)
addTheme(
  'Expansão de Paldea sobre parcerias de batalha. Treinadores e Pokémon entram juntos, com Iono e outros apoiadores do bloco.',
  'A Paldea expansion about battle partners. Trainers and Pokémon come in together, with Iono and other supporters from the block.',
  ['Battle Partners', 'SV9', 'pokemon-standard:SV9']
)
addTheme(
  'Expansão MEGA de tema ninja, com golpes rápidos e disfarce.',
  'A ninja-themed MEGA expansion, with quick strikes and disguise.',
  ['Ninja Spinner', 'M4', 'pokemon-standard:M4']
)
addTheme(
  'Expansão de terra de Paldea, com Ting-Lu. Foi lançada em conjunto com Snow Hazard.',
  'A Paldea earth expansion, with Ting-Lu. It launched alongside Snow Hazard.',
  ['Clay burst', 'SV2D', 'pokemon-standard:SV2D']
)
addTheme(
  'Enhanced Expansion da Eevee e de todas as suas evoluções, do Vaporeon ao Sylveon.',
  'An Enhanced Expansion of Eevee and all of its Evolutions, from Vaporeon to Sylveon.',
  ['Eevee Heroes']
)
addTheme(
  'Expansão MEGA de coragem, liderada pela Mega Lucario.',
  'A bravery MEGA expansion, led by Mega Lucario.',
  ['Mega Brave', 'M1L', 'pokemon-standard:M1L']
)
addTheme(
  'Expansão MEGA do Mewtwo, dividida entre as linhas Munikis e Nihil Zero.',
  'A Mewtwo MEGA expansion, split between the Munikis and Nihil Zero lines.',
  ['Munikis / Nihil Zero', 'M3', 'pokemon-standard:M3']
)
addTheme(
  'Expansão de Paldea sobre o retorno da Equipe Rocket, com os Pokémon sombrios do grupo.',
  'A Paldea expansion about Team Rocket’s return, with the group’s dark Pokémon.',
  ['Glory of Team Rocket', 'SV10', 'pokemon-standard:SV10']
)
addTheme(
  'Expansão de Paldea liderada pelo Charizard da chama negra.',
  'A Paldea expansion led by black-flame Charizard.',
  ['Ruler of the Black Flame', 'SV3', 'pokemon-standard:SV3']
)
addTheme(
  'Expansão MEGA de tom musical, com Gardevoir e Pokémon de espetáculo.',
  'A musical MEGA expansion, with Gardevoir and showpiece Pokémon.',
  ['Mega Symphonia', 'M1S', 'pokemon-standard:M1S']
)
addTheme(
  'Primeira expansão de Paldea na versão Violet, com Miraidon e a academia.',
  'The first Paldea expansion on the Violet side, with Miraidon and the academy.',
  ['Violet ex', 'SV1V', 'pokemon-standard:SV1V']
)
addTheme(
  'Expansão do fim de Espada e Escudo, com Hisui e a mudança para o bloco seguinte.',
  'A late Sword & Shield expansion, with Hisui and the shift toward the next block.',
  ['パラダイムトリガー', 'Paradigm Trigger']
)
addTheme(
  'Expansão de Unova Preta, com Zekrom. Saiu em conjunto com White Flare.',
  'A Unova Black expansion, with Zekrom. It released alongside White Flare.',
  ['Black Bolt', 'SV11B', 'pokemon-standard:SV11B']
)
addTheme(
  'Expansão de Unova Branca, com Reshiram. Saiu em conjunto com Black Bolt.',
  'A Unova White expansion, with Reshiram. It released alongside Black Bolt.',
  ['White Flare', 'SV11W', 'pokemon-standard:SV11W']
)
addTheme(
  'High Class de Pokémon V shiny da era Espada e Escudo.',
  'A High Class of shiny V Pokémon from the Sword & Shield era.',
  ['Shiny Star V']
)
addTheme(
  'Expansão elétrica de Paldea, centrada no Miraidon.',
  'A Paldea Electric expansion, centered on Miraidon.',
  ['Supercharged Breaker / Super Electric Breaker', 'Supercharged Breaker', 'Super Electric Breaker', 'SV8', 'pokemon-standard:SV8']
)
addTheme(
  'Expansão de Espada e Escudo sobre o Lost Zone e Giratina.',
  'A Sword & Shield expansion about the Lost Zone and Giratina.',
  ['Lost Abyss']
)
addTheme(
  'High Class que reúne o auge dos VMAX de Espada e Escudo.',
  'A High Class collecting the peak of Sword & Shield VMAX cards.',
  ['VMAX Climax']
)
addTheme(
  'Coleção pelos 25 anos de Pokémon, com reprints e artes de aniversário.',
  'A collection for Pokémon’s 25th anniversary, with reprints and anniversary arts.',
  ['25th Anniversary Collection']
)
addTheme(
  'Enhanced Expansion de Kitakami, com a Ursaluna Lua Sangrenta.',
  'A Kitakami Enhanced Expansion, with Bloodmoon Ursaluna.',
  ['Crimson Haze', 'SV5A', 'pokemon-standard:SV5A']
)
addTheme(
  'Enhanced Expansion do fim de Espada e Escudo, com treinadores especiais e VSTAR.',
  'A late Sword & Shield Enhanced Expansion, with special trainers and VSTAR cards.',
  ['白熱のアルカナ', 'Incandescent Arcana']
)
addTheme(
  'Enhanced Expansion do começo de Paldea, com os primeiros Pokémon paradoxo.',
  'An Enhanced Expansion from the start of Paldea, with the first paradox Pokémon.',
  ['Triplet Beat', 'SV1A', 'pokemon-standard:SV1A']
)
addTheme(
  'Enhanced Expansion de arena em Paldea, voltada a batalhas e apoiadores de duelo.',
  'A Paldea arena Enhanced Expansion, aimed at battles and duel supporters.',
  ['Hot Wind Arena (Heat Wave Arena)', 'Hot Wind Arena', 'Heat Wave Arena', 'SV9A', 'pokemon-standard:SV9A']
)
addTheme(
  'Expansão de Espada e Escudo sobre Pokémon que se fundem em batalha.',
  'A Sword & Shield expansion about Pokémon that fuse in battle.',
  ['Fusion Arts.']
)
addTheme(
  'Primeira expansão de Paldea na versão Scarlet, com Koraidon e a academia.',
  'The first Paldea expansion on the Scarlet side, with Koraidon and the academy.',
  ['Scarlet ex', 'SV1S', 'pokemon-standard:SV1S']
)
addTheme(
  'Expansão dos paradoxos do futuro, o par de Ancient Roar.',
  'The future-paradox expansion, paired with Ancient Roar.',
  ['Future Flash']
)
addTheme(
  'Enhanced Expansion de água de Paldea, com Palafin.',
  'A Paldea Water Enhanced Expansion, with Palafin.',
  ['Raging Surf', 'SV3A', 'pokemon-standard:SV3A']
)
addTheme(
  'Expansão dos paradoxos ancestrais, com Koraidon. Par de Cyber Judge.',
  'The ancient-paradox expansion, with Koraidon. Paired with Cyber Judge.',
  ['Wild Force', 'SV5K', 'pokemon-standard:SV5K']
)
addTheme(
  'Expansão dos paradoxos do passado, o par de Future Flash.',
  'The past-paradox expansion, paired with Future Flash.',
  ['Ancient roar', 'SV4K', 'pokemon-standard:SV4K']
)
addTheme(
  'Expansão de gelo de Paldea, com Chien-Pao. Foi lançada em conjunto com Clay Burst.',
  'A Paldea ice expansion, with Chien-Pao. It launched alongside Clay Burst.',
  ['Snow hazard', 'SV2P', 'pokemon-standard:SV2P']
)
addTheme(
  'Expansão dos paradoxos de ferro do futuro. Par de Wild Force.',
  'The future Iron-paradox expansion. Paired with Wild Force.',
  ['Cyber Judge', 'SV5M', 'pokemon-standard:SV5M']
)
addTheme(
  'Expansão de Espada e Escudo centrada no Rayquaza e no tipo Dragão.',
  'A Sword & Shield expansion centered on Rayquaza and Dragon-types.',
  ['Blue Sky Stream']
)
addTheme(
  'Expansão de Kitakami sobre Ogerpon e as máscaras que mudam o tipo em batalha.',
  'A Kitakami expansion about Ogerpon and the masks that change type in battle.',
  ['Mask of Change', 'SV6', 'pokemon-standard:SV6']
)
addTheme(
  'Expansão de abertura de Espada e Escudo, com Arceus.',
  'The opening Sword & Shield expansion, with Arceus.',
  ['Star birth']
)
addTheme(
  'Enhanced Expansion de dragões e Terastal, com ênfase em formas dracônicas.',
  'A dragons-and-Terastal Enhanced Expansion, with an emphasis on draconic forms.',
  ['Paradise Dragona', 'SV7A', 'pokemon-standard:SV7A']
)
addTheme(
  'Expansão espacial de Espada e Escudo, com Dialga, Palkia e o tema cósmico do bloco.',
  'A Sword & Shield space expansion, with Dialga, Palkia, and the block’s cosmic theme.',
  ['Space Juggler']
)
addTheme(
  'Expansão sombria de Espada e Escudo, de tipo Sombrio e pressão no campo.',
  'A dark Sword & Shield expansion, Dark-type and board pressure.',
  ['Shigoku Geishi']
)
addTheme(
  'High Class com as Tag Team GX mais conhecidas de Sol e Lua.',
  'A High Class with the best-known Sun & Moon Tag Team GX.',
  ['Tag Team GX Tag All Stars']
)
addTheme(
  'Expansão do Terastal estelar e do Terapagos, no fim do bloco de Paldea.',
  'The stellar Terastal and Terapagos expansion, late in the Paldea block.',
  ['Stellar Miracle', 'SV7', 'pokemon-standard:SV7']
)
addTheme(
  'Expansão de Espada e Escudo centrada no Pikachu e no Volt Tackle.',
  'A Sword & Shield expansion centered on Pikachu and Volt Tackle.',
  ['Vorteker of Heaven']
)
addTheme(
  'Enhanced Expansion de Kitakami à noite, com Pecharunt.',
  'A nighttime Kitakami Enhanced Expansion, with Pecharunt.',
  ['Night Wanderer', 'SV6A', 'pokemon-standard:SV6A']
)
addTheme(
  'Enhanced Expansion de Pokémon GO, com os Pokémon e as mecânicas do jogo mobile.',
  'A Pokémon GO Enhanced Expansion, with the Pokémon and mechanics from the mobile game.',
  ['Pokémon GO']
)
addTheme(
  'Enhanced Expansion de Sol e Lua com Pokémon Fairy e apoiadores especiais.',
  'A Sun & Moon Enhanced Expansion with Fairy Pokémon and special supporters.',
  ['Dream League']
)
addTheme(
  'Expansão de abertura de Galar, com Zacian e a lança prateada.',
  'The opening Galar expansion, with Zacian and the silver lance.',
  ['Silver Lance']
)
addTheme(
  'Enhanced Expansion de Pokémon Ghost em Galar.',
  'A Galar Ghost Pokémon Enhanced Expansion.',
  ['Dark Phantasma']
)
addTheme(
  'Expansão de Hisui centrada no Dialga e no tempo.',
  'A Hisui expansion centered on Dialga and time.',
  ['Time Gazer']
)
addTheme(
  'Enhanced Expansion de Hisui como região de batalha, com formas da terra antiga.',
  'A Hisui-as-battle-region Enhanced Expansion, with ancient-land forms.',
  ['Battle Region']
)
addTheme(
  'Expansão de Sol e Lua sobre Tag Team e Pokémon Elétricos.',
  'A Sun & Moon expansion about Tag Team and Electric Pokémon.',
  ['Tagbolt']
)
addTheme(
  'Expansão das Ultra Beasts e do Gênesis Alterado, no fim de Sol e Lua.',
  'The Ultra Beasts and Alter Genesis expansion, late in Sun & Moon.',
  ['Alternator Genesis']
)
addTheme(
  'Expansão de fechamento de Espada e Escudo, com as últimas linhas do bloco.',
  'The closing Sword & Shield expansion, with the last lines of the block.',
  ['Muten Perfect']
)
addTheme(
  'Enhanced Expansion de dragões e pássaros lendários em Sol e Lua.',
  'A Sun & Moon Enhanced Expansion of dragons and legendary birds.',
  ['Sky Legend']
)
addTheme(
  'Expansão de fogo de Sol e Lua, com Reshiram e Charizard.',
  'A Sun & Moon fire expansion, with Reshiram and Charizard.',
  ['Double Blaze']
)
addTheme(
  'High Class de GX shiny de Sol e Lua.',
  'A Sun & Moon shiny GX High Class.',
  ['GX Ultra Shiny']
)
addTheme(
  'Expansão de Sol e Lua centrada em Latios e Latias.',
  'A Sun & Moon expansion centered on Latios and Latias.',
  ['Miracle Twin']
)
addTheme(
  'Enhanced Expansion do começo de Espada e Escudo, com combate em dupla.',
  'An Enhanced Expansion from the start of Sword & Shield, with paired battle.',
  ['Twin Fighter']
)
addTheme(
  'Expansão de Sol e Lua em que as Ultra Beasts entram pelo céu de Alola.',
  'A Sun & Moon expansion where Ultra Beasts enter through Alola’s sky.',
  ['Charisma of the Wrecked Sky']
)
addTheme(
  'Enhanced Expansion das lendas no começo de Espada e Escudo.',
  'An Enhanced Expansion of legends at the start of Sword & Shield.',
  ['Heartbeat of the Legend']
)
addTheme(
  'Enhanced Expansion que remixa batalhas e apoiadores de Sol e Lua.',
  'An Enhanced Expansion that remixes Sun & Moon battles and supporters.',
  ['Remix Bout']
)
addTheme(
  'Enhanced Expansion que encerra a era GX.',
  'The Enhanced Expansion that closes the GX era.',
  ['Jizzy End']
)
addTheme(
  'Enhanced Expansion de Pokémon do tipo Aço em Sol e Lua.',
  'A Sun & Moon Steel-type Enhanced Expansion.',
  ['Full Metal Wall']
)
addTheme(
  'Enhanced Expansion dos cavaleiros de Sol e Lua.',
  'A Sun & Moon knights Enhanced Expansion.',
  ['Knight Unison']
)
addTheme(
  'Expansão ofensiva no meio de Sol e Lua.',
  'An offensive expansion in the middle of Sun & Moon.',
  ['Super-Burst Impact']
)
addTheme(
  'Expansão de Espada e Escudo no estilo Golpe Fluido: sequências rápidas no mesmo turno.',
  'A Sword & Shield Rapid Strike expansion: fast sequences in the same turn.',
  ['Rengeki Master']
)
addTheme(
  'Pack especial do filme Detective Pikachu.',
  'A special pack for the Detective Pikachu movie.',
  ['Detective Pikachu']
)
addTheme(
  'Expansão de Espada e Escudo no estilo Golpe Decisivo: um ataque forte para encerrar a luta.',
  'A Sword & Shield Single Strike expansion: one heavy attack to end the fight.',
  ['One-Strike Master']
)
addTheme(
  'Enhanced Expansion de Pokémon Fairy em Sol e Lua.',
  'A Sun & Moon Fairy Pokémon Enhanced Expansion.',
  ['Fairy Rise']
)
addTheme(
  'Enhanced Expansion sombria de Alola.',
  'A dark Alola Enhanced Expansion.',
  ['Dark Order']
)
addTheme(
  'Expansão de Sol e Lua centrada no Necrozma e na luz proibida.',
  'A Sun & Moon expansion centered on Necrozma and the forbidden light.',
  ['Forbidden Light']
)
addTheme(
  'Expansão de Alola na versão Ultra Lua, com Ultra Beasts e o outro céu da região.',
  'An Alola Ultra Moon expansion, with Ultra Beasts and the region’s other sky.',
  ['Ultra Moon']
)
addTheme(
  'Enhanced Expansion da primeira onda de VMAX em Espada e Escudo.',
  'The Enhanced Expansion for the first VMAX wave in Sword & Shield.',
  ['VMAX Rising']
)
addTheme(
  'Expansão de fogo no começo de Galar.',
  'A fire expansion at the start of Galar.',
  ['Blazing Walker']
)
addTheme(
  'Enhanced Expansion de lendas shiny em Sol e Lua.',
  'A shiny-legends Enhanced Expansion in Sun & Moon.',
  ['Shines Legend']
)
addTheme(
  'Expansão elétrica de Alola.',
  'An Alola Electric expansion.',
  ['Thunderclap Spark']
)
addTheme(
  'Enhanced Expansion do caminho dos campeões de Alola.',
  'An Enhanced Expansion for Alola’s champion road.',
  ['Champion Road']
)
addTheme(
  'Expansão de dragões em Sol e Lua.',
  'A Sun & Moon dragon expansion.',
  ['Dragon Storm']
)
addTheme(
  'Enhanced Expansion das Ultra Beasts.',
  'An Ultra Beasts Enhanced Expansion.',
  ['Ultra Force']
)
addTheme(
  'Enhanced Expansion de lançamento de Sol e Lua em Alola.',
  'The launch Enhanced Expansion for Sun & Moon in Alola.',
  ['サン&ムーン', 'Sun & Moon']
)
addTheme(
  'Enhanced Expansion das novas provas de Alola, com Ultra Beasts no caminho.',
  'An Enhanced Expansion of Alola’s new trials, with Ultra Beasts on the path.',
  ["New Be's Test"]
)

addTheme(
  'Booster básico que abre um novo ciclo do OCG, centrado em Caos e em arquétipos novos.',
  'A core booster that opens a new OCG cycle, centered on Chaos and new archetypes.',
  ['CHAOS ORIGINS']
)
addTheme(
  'Edição de 25 anos de Yu-Gi-Oh!, com artes clássicas e reprints de cartas históricas.',
  'A 25th-anniversary Yu-Gi-Oh! edition, with classic art and reprints of historic cards.',
  ['PREMIUM PACK The Legend of Duelist QUARTER CENTURY EDITION', 'Quarter Century', 'QUARTER CENTURY DUELIST']
)
addTheme(
  'Pack conceitual com reprints fortes e algumas cartas de impacto reunidas num só box.',
  'A concept pack with strong reprints and a few high-impact cards gathered in one box.',
  ['SELECTION 5']
)
addTheme(
  'Limited pack do dormitório Ra Amarelo de GX.',
  'A limited pack for GX’s Ra Yellow dorm.',
  ['Ra Yellow']
)
addTheme(
  'Pack especial com artes originais de Kazuki Takahashi.',
  'A special pack of original artwork by Kazuki Takahashi.',
  ['Yu-Gi-Oh ORIGINAL ARTWORK COLLECTION']
)
addTheme(
  'Booster básico recente do OCG, com os arquétipos novos daquele ciclo.',
  'A recent core OCG booster, with the new archetypes of that cycle.',
  ['Beyond The Brave']
)
addTheme(
  'Pack especial de cartas utilitárias, feitas para entrar em vários decks.',
  'A special pack of utility cards, built to fit into many decks.',
  ['UTILITY SELECTION']
)
addTheme(
  'Booster básico de asas negras, com arquétipos sombrios daquele ciclo do OCG.',
  'A dark-wing core booster, with shadowy archetypes from that OCG cycle.',
  ['Darkwing Blast']
)
addTheme(
  'Limited pack do dormitório Osíris Vermelho de GX.',
  'A limited pack for GX’s Osiris Red dorm.',
  ['GX OSIRIS RED']
)
addTheme(
  'Limited pack carimbado de evento, com cartas que saíram só nessa edição.',
  'A stamped event limited pack, with cards that only came out in this edition.',
  ['-STAMP EDITION-']
)
addTheme(
  'Booster básico em que vários arquétipos novos se cruzam no mesmo Extra Deck.',
  'A core booster where several new archetypes cross in the same Extra Deck.',
  ['DUELIST NEXUS', 'DUNE']
)
addTheme(
  'Booster básico de Caos, com os arquétipos daquele ciclo do OCG.',
  'A Chaos core booster, with the archetypes of that OCG cycle.',
  ['Battle of Chaos']
)
addTheme(
  'Duelist Pack da sexta leva de duelistas lendários, cada um com o deck que o tornou conhecido.',
  'A Duelist Pack for the sixth wave of legendary duelists, each with the deck they are known for.',
  ['Duelist Pack - Legend Duelist 6']
)
addTheme(
  'Booster básico Photon, de luz e Extra Deck ofensivo.',
  'A Photon core booster, light-themed with an offensive Extra Deck.',
  ['Photon HyperNova']
)
addTheme(
  'Booster básico dos elementos, com atributos em choque e arquétipos novos.',
  'An elemental core booster, with clashing attributes and new archetypes.',
  ['Power of the Elements']
)
addTheme(
  'Limited pack com as cartas do World Championship 2026.',
  'A limited pack with the World Championship 2026 cards.',
  ['WORLD CHAMPIONSHIP 2026']
)
addTheme(
  'Booster básico recente de fogo do OCG, com os arquétipos daquele ciclo.',
  'A recent fire-themed OCG core booster, with the archetypes of that cycle.',
  ['BLAZING DOMINION']
)
addTheme(
  'Premium Pack de 2023, com holos e reprints daquele ano.',
  'The 2023 Premium Pack, with holos and reprints from that year.',
  ['Premium Pack 2023']
)
addTheme(
  'Booster básico Cyberse, com acesso à tempestade cibernética daquele ciclo.',
  'A Cyberse core booster, with access to that cycle’s cyberstorm.',
  ['Cyberstorm Access', 'CYAC']
)
addTheme(
  'Deck Build de cruzamento: arquétipos diferentes pensados para se combinar no mesmo extra.',
  'A crossover Deck Build: different archetypes designed to combine in the same Extra Deck.',
  ['Crossover Breakers']
)
addTheme(
  'Booster básico do Rei Supremo e da era Overlord.',
  'A Supreme King / Age of Overlord core booster.',
  ['Age Of Overlord']
)
addTheme(
  'Pack com cartas que estrearam no TCG em 2023 e depois chegaram ao OCG.',
  'A pack of cards that debuted in the TCG in 2023 and later arrived in the OCG.',
  ['World Premiere Pack 2023']
)
addTheme(
  'Booster básico focado em novas linhas do Extra Deck.',
  'A core booster focused on new Extra Deck lines.',
  ['Dimension Force']
)
addTheme(
  'Limited pack com as cartas do World Championship 2025.',
  'A limited pack with the World Championship 2025 cards.',
  ['WORLD CHAMPIONSHIP 2025']
)
addTheme(
  'Booster básico do infinito proibido: selos antigos e cartas que o OCG trata como tabu.',
  'A core booster of the infinite forbidden: ancient seals and cards the OCG treats as taboo.',
  ['INFINITE FORBIDDEN', 'INFO']
)
addTheme(
  'Pack com estreias mundiais de 2026 no OCG.',
  'A pack of 2026 world premieres in the OCG.',
  ['WORLD PREMIERE PACK 2026']
)
addTheme(
  'Pack com estreias mundiais de 2022 no OCG.',
  'A pack of 2022 world premieres in the OCG.',
  ['World Premiere Pack 2022']
)
addTheme(
  'Booster básico de raios daquele ciclo do OCG.',
  'A lightning core booster from that OCG cycle.',
  ['Lightning Overdrive']
)
addTheme(
  'Premium Pack de 2021, com holos daquele ano.',
  'The 2021 Premium Pack, with holos from that year.',
  ['Premium Pack 2021']
)
addTheme(
  'Deck Build de caçadores, com arquétipos feitos para fechar o jogo.',
  'A hunters Deck Build, with archetypes built to close out games.',
  ['Justice Hunters']
)
addTheme(
  'Booster básico de majestade daquele ciclo do OCG.',
  'A majesty-themed core booster from that OCG cycle.',
  ['Dawn of Majesty']
)
addTheme(
  'Booster básico de fogo daquele ciclo do OCG.',
  'A fire core booster from that OCG cycle.',
  ['Blazing Vortex']
)
addTheme(
  'Booster básico de destino daquele ciclo do OCG.',
  'A destiny-themed core booster from that OCG cycle.',
  ['Burst of Destiny']
)
addTheme(
  'Booster básico de Yubel e do Extra Deck sombrio daquele ciclo.',
  'A Yubel core booster and the dark Extra Deck of that cycle.',
  ['Phantom Nightmare', 'PHNI']
)
addTheme(
  'Segunda onda do pack de 20 anos, com reprints que não caberam na primeira.',
  'The second wave of the 20th Anniversary pack, with reprints that did not fit the first.',
  ['20th Anniversary Pack 2nd Wave']
)
addTheme(
  'Pack com estreias mundiais de 2021 no OCG.',
  'A pack of 2021 world premieres in the OCG.',
  ['World Premiere Pack 2021']
)
addTheme(
  'Pack conceitual com decks das animações de Yu-Gi-Oh! em 2024.',
  'A concept pack with 2024 Yu-Gi-Oh! animation decks.',
  ['ANIMATION CHRONICLE 2024']
)
addTheme(
  'Booster básico de destruição de campo, com arquétipos que limpam a mesa.',
  'A field-destruction core booster, with archetypes that clear the board.',
  ['LEGACY OF DESTRUCTION', 'LEDE']
)
addTheme(
  'Premium Pack de 2024, com holos daquele ano.',
  'The 2024 Premium Pack, with holos from that year.',
  ['Premium Pack 2024']
)
addTheme(
  'Deck Build dos arquétipos vitoriosos daquele ciclo.',
  'A Deck Build of the winning archetypes from that cycle.',
  ['Deck-Build Pack: Glorious Victors']
)
addTheme(
  'Premium Pack de 2022, com holos daquele ano.',
  'The 2022 Premium Pack, with holos from that year.',
  ['Premium Pack 2022']
)
addTheme(
  'Deck Build de natureza e sobrevivência, com arquétipos de terreno e combate.',
  'A nature-and-survival Deck Build, with terrain and combat archetypes.',
  ['WILD SURVIVORS']
)
addTheme(
  'Pack com estreias mundiais de 2025 no OCG.',
  'A pack of 2025 world premieres in the OCG.',
  ['WORLD PREMIERE PACK 2025']
)
addTheme(
  'Premium Pack de 2026, com holos daquele ano.',
  'The 2026 Premium Pack, with holos from that year.',
  ['PREMIUM PACK 2026']
)
addTheme(
  'Premium Pack de 2025, com holos daquele ano.',
  'The 2025 Premium Pack, with holos from that year.',
  ['PREMIUM PACK 2025']
)
addTheme(
  'Deck Build de lutadores místicos, com ritual e combate no mesmo extra.',
  'A mystic fighters Deck Build, with ritual and combat in the same Extra Deck.',
  ['Mystic Fighters']
)
addTheme(
  'Pack com estreias mundiais de 2024 no OCG.',
  'A pack of 2024 world premieres in the OCG.',
  ['WORLD PREMIERE PACK 2024']
)
addTheme(
  'Duelist Pack de duelistas ofensivos daquele ciclo.',
  'A Duelist Pack of offensive duelists from that cycle.',
  ['Duelist Pack Explosive Duelist']
)
addTheme(
  'Duelist Pack do vento, com o duelista e o deck associados a esse atributo.',
  'A wind Duelist Pack, with the duelist and deck tied to that attribute.',
  ['Duelist Pack - Duelist of the Distilled Wind']
)
addTheme(
  'Booster básico de escuridão daquele ciclo do OCG.',
  'A darkness core booster from that OCG cycle.',
  ['SUPREME DARKNESS', 'SUDA']
)

addTheme(
  'Weiss Schwarz pelos 100 anos da Disney, com os personagens clássicos da companhia.',
  'Weiss Schwarz for Disney’s 100th anniversary, with the company’s classic characters.',
  ['Disney100']
)
addTheme(
  'Weiss Schwarz da Hololive Production vol. 2, com as talents da segunda leva.',
  'Weiss Schwarz Hololive Production Vol. 2, with the second-wave talents.',
  ['Hololive Production Vol.2 #Spreading Weiss Schwarz']
)
addTheme(
  'Goddess of Victory: NIKKE. Cobre as squads, as heroínas e o tom de tiro e memória do jogo.',
  'Goddess of Victory: NIKKE. It covers the squads, the heroines, and the game’s gunfire-and-memory tone.',
  ['Goddess of Victory : NIKKE', 'GODDESS OF VICTORY: NIKKE', 'Goddess of Victory: NIKKE Vol. 2', 'UA18BT']
)
addTheme(
  'Weiss Schwarz de Re:Zero, volume 3. Avança o loop de Subaru, Emilia e o elenco daquele arco.',
  'Weiss Schwarz Re:Zero, Vol. 3. It moves Subaru’s loop forward, with Emilia and the cast of that arc.',
  ['Re:ZERO-Starting Life in Another World Vol.3']
)
addTheme(
  'Weiss Schwarz de Re:Zero, volume 4. Segue o elenco depois dos volumes anteriores, com mais consequência e menos apresentação.',
  'Weiss Schwarz Re:Zero, Vol. 4. It follows the cast after the earlier volumes, with more consequence and less introduction.',
  ['Re:ZERO-Starting Life in Another World Vol.4']
)
addTheme(
  'Re:Zero — Starting Life in Another World. Subaru, Emilia e o começo do loop.',
  'Re:Zero — Starting Life in Another World. Subaru, Emilia, and the start of the loop.',
  ['Re:ZERO-Starting Life in Another World', 'UA40BT']
)
addTheme(
  'Remix da Hololive vol. 1 e 2, reunindo talents das duas caixas num só booster.',
  'A Hololive Vol. 1 and 2 remix, gathering talents from both boxes in one booster.',
  ['Hololive Production Vol.1&Vol.2 Re:Mix']
)
addTheme(
  'Weiss Schwarz de Frieren: Além da Jornada. Cobre Frieren, Fern, Stark e o grupo depois do fim da aventura original.',
  'Weiss Schwarz Frieren: Beyond Journey’s End. It covers Frieren, Fern, Stark, and the group after the original adventure ended.',
  ['Frieren: Beyond Journey\'s End', "Frieren: Beyond Journey's End", 'Frieren Beyond Journey\'s End,Vol.2', "Frieren Beyond Journey's End,Vol.2", "Frieren: Beyond Journey's End New Edition"]
)
addTheme(
  'Weiss Schwarz da Hololive Production, com as talents da primeira leva dessa parceria.',
  'Weiss Schwarz Hololive Production, with the talents from the first wave of this pairing.',
  ['Hololive Production']
)
addTheme(
  'Weiss Schwarz de Brown Dust 2, com os mercenários e o elenco do RPG.',
  'Weiss Schwarz Brown Dust 2, with the mercenaries and the RPG cast.',
  ['BrownDust2']
)
addTheme(
  'Azur Lane volume 2, com mais kansen e a continuação da frota.',
  'Azur Lane Vol. 2, with more kansen and the continuation of the fleet.',
  ['Azur Lane Vol.2']
)
addTheme(
  'Weiss Schwarz de Azur Lane, com as kansen e o porto do jogo.',
  'Weiss Schwarz Azur Lane, with the kansen and the game’s port.',
  ['Azur Lane']
)
addTheme(
  'Weiss Schwarz das light novels da GA Bunko, reunindo várias heroínas da editora.',
  'Weiss Schwarz for GA Bunko light novels, gathering several heroines from the imprint.',
  ['GA Bunko']
)
addTheme(
  'Weiss Schwarz de Touhou Project, com as personagens de Gensokyo.',
  'Weiss Schwarz Touhou Project, with the characters of Gensokyo.',
  ['Touhou Project: Black and White Lotus Land']
)
addTheme(
  'Weiss Schwarz dos personagens da Pixar.',
  'Weiss Schwarz Pixar characters.',
  ['PIXAR CHARACTERS']
)
addTheme(
  'Oshi no Ko, com Ai, Aqua e Ruby. Cobre o palco e o avesso da indústria.',
  'Oshi no Ko, with Ai, Aqua, and Ruby. It covers the stage and the underside of the industry.',
  ['Oshi no Ko', 'Oshi no Ko Vol.3']
)
addTheme(
  'Lycoris Recoil, com Chisato e Takina no café e no trabalho que ele esconde.',
  'Lycoris Recoil, with Chisato and Takina at the café and the work it hides.',
  ['Lycoris Recoil']
)
addTheme(
  'Gakuen Idolmaster: idols da escola, entre aula e palco.',
  'Gakuen Idolmaster: school idols, between class and stage.',
  ['Gakuen Idolmaster', 'Gakuen Idol Master', 'Gakuen Idol Master Vol.2', 'UA27BT']
)
addTheme(
  'Blue Archive The Animation, com as alunas de Kivotos no recorte do anime.',
  'Blue Archive The Animation, with the students of Kivotos in the anime’s cut.',
  ['Blue Archive The Animation']
)
addTheme(
  'Weiss Schwarz pelos 30 anos de Toy Story, com Woody, Buzz e o elenco clássico.',
  'Weiss Schwarz for 30 years of Toy Story, with Woody, Buzz, and the classic cast.',
  ['Toy Story 30YEARS&BEYOND']
)
addTheme(
  'Chainsaw Man, com Denji, Makima e os diabos da história.',
  'Chainsaw Man, with Denji, Makima, and the story’s devils.',
  ['Chainsaw Man', 'UA53BT']
)
addTheme(
  'Rascal Does Not Dream, com Sakuta, Mai e o recorte sobrenatural do bairro.',
  'Rascal Does Not Dream, with Sakuta, Mai, and the neighborhood’s supernatural cut.',
  ['Rascal Does Not Dream']
)
addTheme(
  'Bocchi the Rock!, com Hitori Gotoh e a Kessoku Band.',
  'Bocchi the Rock!, with Hitori Gotoh and Kessoku Band.',
  ['Bocchi The Rock!']
)
addTheme(
  'Dan Da Dan, com Okarun e Momo no cruzamento de ovni e espírito.',
  'Dan Da Dan, with Okarun and Momo at the crossing of UFO and spirit.',
  ['TV Anime Dandadan', 'TV Anime Dandadan Vol.2']
)
addTheme(
  'Disney Mirror Warriors, com clássicos da Disney em chave de combate.',
  'Disney Mirror Warriors, with Disney classics in a combat key.',
  ['Disney Mirror Warriors']
)
addTheme(
  'The Quintessential Quintuplets, com as cinco irmãs Nakano.',
  'The Quintessential Quintuplets, with the five Nakano sisters.',
  ['The Quintessential Quintuplets', 'Movie The Quintessential Quintuplets']
)
addTheme(
  'Uma Musume Pretty Derby, com as corredoras e as pistas do jogo.',
  'Uma Musume Pretty Derby, with the racers and the game’s tracks.',
  ['Uma Musume Pretty Derby']
)
addTheme(
  'MyGO!!!!! e Ave Mujica, as duas bandas de BanG Dream! neste recorte.',
  'MyGO!!!!! and Ave Mujica, the two BanG Dream! bands in this cut.',
  ['MyGO!!!!! x Ave Mujica']
)
addTheme(
  'Heaven Burns Red volume 2, com o elenco do TRPG depois da primeira caixa.',
  'Heaven Burns Red Vol. 2, with the TRPG cast after the first box.',
  ['Heaven Burns Red Vol.2']
)
addTheme(
  'Persona 5, com o Joker, o café Leblanc e os Phantom Thieves.',
  'Persona 5, with Joker, Café Leblanc, and the Phantom Thieves.',
  ['Persona 5']
)
addTheme(
  'Weiss Schwarz pelos 10 anos de Sword Art Online, com Kirito, Asuna e o elenco da franquia.',
  'Weiss Schwarz for 10 years of Sword Art Online, with Kirito, Asuna, and the franchise cast.',
  ['Sword Art Online 10th Anniversary']
)
addTheme(
  'SPY x FAMILY, com Loid, Yor e Anya Forger.',
  'SPY x FAMILY, with Loid, Yor, and Anya Forger.',
  ['SPY x FAMILY']
)
addTheme(
  'THE IDOLM@STER SHINY COLORS Shine More!, com as idols da 283 Production.',
  'THE IDOLM@STER SHINY COLORS Shine More!, with the 283 Production idols.',
  ['アイドルマスター シャイニーカラーズ Shine More!']
)
addTheme(
  'Weiss Schwarz de Marvel Studios, com os heróis do recorte cinematográfico.',
  'Weiss Schwarz Marvel Studios, with the heroes from the film cut.',
  ['MARVEL Vol.3 [MARVEL STUDIOS]', 'Marvel/Card Collection']
)
addTheme(
  'Aogiri High School, com o elenco e o cenário escolar da obra.',
  'Aogiri High School, with the cast and school setting of the series.',
  ['Aogiri High School']
)
addTheme(
  'Love Live! Nijigasaki, com as idols da escola Nijigasaki.',
  'Love Live! Nijigasaki, with the idols of Nijigasaki High.',
  ['Lovelive! Nijigasaki Gakuen School Idol Club Feat.School Idol Festival ALL STARS']
)
addTheme(
  'Weiss Schwarz da série Tales of, com swordsmen e o elenco dos jogos.',
  'Weiss Schwarz Tales of series, with swordsmen and the games’ cast.',
  ['Tales of']
)
addTheme(
  'Summer Pockets, com as heroínas da ilha e o verão do visual novel.',
  'Summer Pockets, with the island heroines and the visual novel’s summer.',
  ['Summer Pockets']
)
addTheme(
  'Cardcaptor Sakura: Clear Card, com Sakura, Syaoran e as cartas transparentes.',
  'Cardcaptor Sakura: Clear Card, with Sakura, Syaoran, and the clear cards.',
  ['Cardcaptor Sakura: Clear Card']
)
addTheme(
  'Love Live! Superstar!!, com o grupo Liella!.',
  'Love Live! Superstar!!, with Liella!.',
  ['Lovelive! Super Star!!']
)
addTheme(
  'Tokyo Revengers, com Takemichi e as gangues de Tóquio.',
  'Tokyo Revengers, with Takemichi and the Tokyo gangs.',
  ['Tokyo Revengers']
)
addTheme(
  'Alice Gear Aegis, com as combatentes e o equipamento da série.',
  'Alice Gear Aegis, with the fighters and gear of the series.',
  ['Alice Gear Aegis Expansion']
)
addTheme(
  'Kaiju No. 8, com Kafka Hibino, Kikoru e a força de defesa contra kaiju.',
  'Kaiju No. 8, with Kafka Hibino, Kikoru, and the kaiju defense force.',
  ['Kaiju No.8']
)
addTheme(
  'The Fruit of Grisaia, com as garotas da mansão Mihama.',
  'The Fruit of Grisaia, with the girls of Mihama mansion.',
  ['Fruit Of Grisaia']
)

addTheme(
  'Primeiro booster de Dragon Ball Super: Fusion World. Goku e o começo do novo jogo.',
  'The first Dragon Ball Super: Fusion World booster. Goku and the start of the new game.',
  ['Heartbeat of Awakening', 'FB01']
)
addTheme(
  'Story booster que segue a narrativa de Dragon Ball, mais linear do que um booster comum.',
  'A story booster that follows the Dragon Ball narrative, more linear than a regular booster.',
  ['STORY BOOSTER 01']
)
addTheme(
  'Booster dos guerreiros Z em combate direto, com o elenco clássico da série.',
  'A booster of the Z Fighters in direct combat, with the series’ classic cast.',
  ['Fierce Fighting Spirit', 'FB02']
)
addTheme(
  'Booster de evoluções em dupla no Fusion World. O par é a unidade de combate.',
  'A paired-evolution booster in Fusion World. The pair is the combat unit.',
  ['DUAL EVOLUTION', 'FB09']
)
addTheme(
  'Booster de esperança do Fusion World, com o tom mais claro da linha.',
  'A Fusion World hope booster, with the brighter tone of the line.',
  ['BRIGHTNESS OF HOPE', 'FB11']
)
addTheme(
  'Booster em que duas forças se cruzam no mesmo campo do Fusion World.',
  'A booster where two forces cross on the same Fusion World field.',
  ['CROSS FORCE', 'FB10']
)
addTheme(
  'Booster dos Saiyajins, com transformações e o ki característico da raça.',
  'A Saiyan booster, with transformations and the race’s characteristic ki.',
  ['Raging Roar', 'FB03']
)
addTheme(
  'Booster das transformações além do limite, no estilo clássico de Dragon Ball.',
  'A beyond-the-limit transformations booster, in classic Dragon Ball style.',
  ['Beyond the Limits', 'FB04']
)
addTheme(
  'Booster de uma aventura ainda pouco mapeada no Fusion World.',
  'A booster for an adventure still lightly mapped in Fusion World.',
  ['Booster Pack Unknown Adventure', 'Unknown Adventure', 'FB05']
)
addTheme(
  'Booster de Shenlong e das Esferas do Dragão, com os desejos que mudam a história.',
  'A Shenron and Dragon Balls booster, with the wishes that change the story.',
  ['WISH FOR SHENRON', 'FB07']
)

addTheme(
  'To Love-Ru pelas memórias das heroínas, com Lala e o elenco clássico da série.',
  'To Love-Ru through the heroines’ memories, with Lala and the classic cast.',
  ['To Love-Ru Memory of Heroines']
)
addTheme(
  'Solo Leveling, com Sung Jinwoo e a subida pelos andares da dungeon.',
  'Solo Leveling, with Sung Jinwoo and the climb through the dungeon floors.',
  ['Solo Leveling', 'UA51BT']
)
addTheme(
  'Mushoku Tensei: Jobless Reincarnation, com Rudeus e o começo da segunda vida.',
  'Mushoku Tensei: Jobless Reincarnation, with Rudeus and the start of the second life.',
  ['Mushoku Tensei: Jobless Reincarnation', 'UA54BT']
)
addTheme(
  'Bleach: Thousand-Year Blood War, volume 3. Terceiro ato da guerra contra os Quincy.',
  'Bleach: Thousand-Year Blood War, Vol. 3. The third act of the war against the Quincy.',
  ['BLEACH Thousand-Year Blood War Vol.3']
)
addTheme(
  'Bleach: Thousand-Year Blood War, volume 2. Meio da guerra, com Soul Society e Quincy.',
  'Bleach: Thousand-Year Blood War, Vol. 2. Mid-war, with Soul Society and the Quincy.',
  ['BLEACH Thousand-year blood war Vol.2']
)
addTheme(
  'Bleach: Thousand-Year Blood War. Ichigo de volta à guerra final do mangá.',
  'Bleach: Thousand-Year Blood War. Ichigo back in the manga’s final war.',
  ['BLEACH Thousand-year blood war', 'UA01DC']
)
addTheme(
  'The Eminence in Shadow, com Cid Kagenou e a Shadow Garden.',
  'The Eminence in Shadow, with Cid Kagenou and Shadow Garden.',
  ['The Eminence in Shadow', 'UA52BT']
)
addTheme(
  'Attack on Titan, com Eren, os titãs e o que sobra da humanidade encurralada.',
  'Attack on Titan, with Eren, the titans, and what remains of boxed-in humanity.',
  ['Attack on Titan', 'Attack on Titan Vol.2', 'UA23BT']
)
addTheme(
  'Inuyasha, com Kagome, Inuyasha e a poço que liga o presente ao Sengoku.',
  'Inuyasha, with Kagome, Inuyasha, and the well that joins the present to the Sengoku.',
  ['Inuyasha', 'UA50BT']
)
addTheme(
  'Macross volume 2, com mais valquírias, canções e VF da série.',
  'Macross Vol. 2, with more valkyries, songs, and VFs from the series.',
  ['Macross Series Vol. 2']
)
addTheme(
  'Série Macross, com canções, VF-1 e o céu de combate da franquia.',
  'The Macross series, with songs, the VF-1, and the franchise’s combat sky.',
  ['Macross Series', 'UA36BT']
)
addTheme(
  'Sword Art Online volume 2, com Kirito, Asuna e a continuação do elenco.',
  'Sword Art Online Vol. 2, with Kirito, Asuna, and the continuing cast.',
  ['Sword Art Online Vol.2']
)
addTheme(
  'Puella Magi Madoka Magica, com Madoka, Homura e o contrato das magical girls.',
  'Puella Magi Madoka Magica, with Madoka, Homura, and the magical-girl contract.',
  ['Puella Magi Madoka Magica', 'UA31BT']
)
addTheme(
  'Madoka Magica: Magia Exedra, com as mesmas garotas no recorte do jogo.',
  'Madoka Magica: Magia Exedra, with the same girls in the game’s cut.',
  ['Puella Magi Madoka Magica: Magia Exedra']
)
addTheme(
  'Kagurabachi, com Chihiro e a espada herdada no Japão contemporâneo.',
  'Kagurabachi, with Chihiro and the inherited sword in contemporary Japan.',
  ['Kagurabachi', 'UA46BT']
)
addTheme(
  'THE IDOLM@STER CINDERELLA GIRLS, com as idols da agência.',
  'THE IDOLM@STER CINDERELLA GIRLS, with the agency’s idols.',
  ['THE IDOLM@STER CINDERELLA GIRLS', 'UA55BT']
)
addTheme(
  'Gurren Lagann, com Simon, Kamina e os mechas de broca.',
  'Gurren Lagann, with Simon, Kamina, and the drill mecha.',
  ['Gurren Lagann', 'UA56BT']
)
addTheme(
  'Hunter x Hunter, com Gon, Killua e o exame de hunter.',
  'Hunter x Hunter, with Gon, Killua, and the hunter exam.',
  ['HUNTERxHUNTER']
)
addTheme(
  'Evangelion: New Theatrical Edition. Shinji, as Evas e o recorte dos filmes novos.',
  'Evangelion: New Theatrical Edition. Shinji, the Evas, and the new-film cut.',
  ['Evangelion: New Theatrical Edition', 'UA44BT']
)
addTheme(
  'Kingdom, com Xin e a unificação dos Reinos Combatentes.',
  'Kingdom, with Xin and the unification of the Warring States.',
  ['KINGDOM', 'UA48BT']
)
addTheme(
  'Tokyo Ghoul, com Kaneki entre humanos e ghouls.',
  'Tokyo Ghoul, with Kaneki between humans and ghouls.',
  ['Tokyo Ghoul', 'UA47BT']
)
addTheme(
  'SHY, com a heroína tímida e os heróis da série.',
  'SHY, with the shy heroine and the series’ heroes.',
  ['SHY', 'UA24BT']
)
addTheme(
  '2.5 Dimensional Seduction, com Lilysa e o palco 2.5D.',
  '2.5 Dimensional Seduction, with Lilysa and the 2.5D stage.',
  ['2.5 Dimensional Seduction', 'UA33BT']
)
addTheme(
  'That Time I Got Reincarnated as a Slime, volume 2. Rimuru já com país e o elenco depois da primeira caixa.',
  'That Time I Got Reincarnated as a Slime, Vol. 2. Rimuru already with a country, and the cast after the first box.',
  ['That Time I Got Reincarnated as a Slime Vol.2']
)
addTheme(
  'That Time I Got Reincarnated as a Slime. Rimuru no começo, ainda como slime no outro mundo.',
  'That Time I Got Reincarnated as a Slime. Rimuru at the start, still a slime in the other world.',
  ['That Time I Got Reincarnated as a Slime']
)
addTheme(
  'Arknights, com os operadores, Originium e o conflito de Terra.',
  'Arknights, with the operators, Originium, and Terra’s conflict.',
  ['Arknights', 'Arknights Vol.2', 'UA30BT']
)
addTheme(
  'Demon Slayer volume 2, com Tanjiro e a continuação depois da apresentação da respiração.',
  'Demon Slayer Vol. 2, with Tanjiro and the continuation after introducing the breathing.',
  ['Demon Slayer vol.2']
)
addTheme(
  'The 100 Girlfriends Who Really Love You, com Aijou Rentarou e o elenco enorme da obra.',
  'The 100 Girlfriends Who Really Love You, with Aijou Rentarou and the series’ huge cast.',
  ['The 100 Girlfriends Who Really Really Really Really Really Love You', 'UA26BT']
)
addTheme(
  'Code Geass: Lelouch of the Rebellion. Lelouch, C.C. e a rebelião em Britannia.',
  'Code Geass: Lelouch of the Rebellion. Lelouch, C.C., and the rebellion in Britannia.',
  ['Code Geass Lelouch of the Rebellion']
)
addTheme(
  'Jujutsu Kaisen, com Yuji, Gojo e a escola de feitiçaria.',
  'Jujutsu Kaisen, with Yuji, Gojo, and the jujutsu school.',
  ['Jujutsu Kaisen']
)
addTheme(
  'Haikyu!!, com Hinata, Kageyama e o vôlei do Karasuno.',
  'Haikyu!!, with Hinata, Kageyama, and Karasuno volleyball.',
  ['Haikyu!!', 'UA19BT']
)
addTheme(
  'Chained Soldier, com a unidade e o recorte de ação da série.',
  'Chained Soldier, with the unit and the series’ action cut.',
  ['Chained Soldier']
)
addTheme(
  'Black Clover, com Asta, Yuno e o reino de Clover.',
  'Black Clover, with Asta, Yuno, and the Clover Kingdom.',
  ['Black Clover']
)
addTheme(
  'THE IDOLM@STER SHINY COLORS, com as idols da 283 Production.',
  'THE IDOLM@STER SHINY COLORS, with the 283 Production idols.',
  ['THE IDOLM@STER SHINY COLORS']
)
addTheme(
  'Fullmetal Alchemist, com Ed, Al e a troca equivalente.',
  'Fullmetal Alchemist, with Ed, Al, and equivalent exchange.',
  ['Fullmetal Alchemist', 'UA37BT']
)
addTheme(
  'Sakamoto Days, com Taro Sakamoto entre a mercearia e o passado de assassino.',
  'Sakamoto Days, with Taro Sakamoto between the store and his assassin past.',
  ['SAKAMOTO DAYS']
)
addTheme(
  'One-Punch Man, com Saitama e a Associação de Heróis.',
  'One-Punch Man, with Saitama and the Hero Association.',
  ['One Punch-Man']
)
addTheme(
  'Shangri-La Frontier, com Sunraku no VRMMO que dói de verdade.',
  'Shangri-La Frontier, with Sunraku in the VRMMO that actually hurts.',
  ['Shangri-la Frontier', 'UA32BT']
)
addTheme(
  'Série Monogatari, com Araragi, as heroínas e o recorte de conversa da obra.',
  'The Monogatari Series, with Araragi, the heroines, and the work’s talk-heavy cut.',
  ['Monogatari Series']
)
addTheme(
  'Undead Unluck, com Andy e Fuuko e as regras de imortalidade e azar.',
  'Undead Unluck, with Andy and Fuuko and the rules of immortality and bad luck.',
  ['Undead-Unluck', 'UA25BT']
)
addTheme(
  'Toriko, com o caçador gourmet e o mundo em que comida é campo de batalha.',
  'Toriko, with the gourmet hunter and the world where food is a battlefield.',
  ['Toriko']
)
addTheme(
  'Code Geass: Roze of the Recapture. Nova geração, no mesmo universo da rebelião.',
  'Code Geass: Roze of the Recapture. A new generation, in the same rebellion universe.',
  ['CODE GEASS Roze of the Recapture']
)
addTheme(
  'Gintama, com Gintoki, Kagura, Shinpachi e o Edo que mistura samurai e piada.',
  'Gintama, with Gintoki, Kagura, Shinpachi, and the Edo that mixes samurai and joke.',
  ['Gintama', 'UA11BT']
)
addTheme(
  'Rurouni Kenshin, com Himura Kenshin no Meiji depois de largar o assassino.',
  'Rurouni Kenshin, with Himura Kenshin in the Meiji after putting down the assassin.',
  ['Rurouni Kenshin: Meiji Swordsman Romantic Story', 'UA41BT']
)

addTheme(
  'Gundam SEED Freedom, centrado na Freedom e no retorno daquela linha da franquia.',
  'Gundam SEED Freedom, centered on the Freedom and the return of that franchise line.',
  ['Freedom Ascension', 'Freedom Ascension Bonus Pack', 'GD05']
)
addTheme(
  'Primeiro booster do Gundam Card Game. Newtypes da Universal Century, com Amuro e Char.',
  'The first Gundam Card Game booster. Universal Century Newtypes, with Amuro and Char.',
  ['Newtype Rising', 'GD01']
)
addTheme(
  'Booster de pilotos e trajes furtivos, com menos ênfase no heroísmo de cartaz.',
  'A booster of stealth pilots and suits, with less emphasis on poster heroism.',
  ['Phantom Aria', 'GD04']
)
addTheme(
  'Booster do choque entre duas facções, com os mobile suits dos dois lados.',
  'A booster for the clash between two factions, with mobile suits from both sides.',
  ['Dual Impact', 'GD02']
)
addTheme(
  'Booster de guerra e mobile suits pesados, no tom mais sombrio da linha.',
  'A war and heavy-mobile-suit booster, in the darker tone of the line.',
  ['Steel Requiem', 'GD03']
)
addTheme(
  'Extra booster que cruza as sagas de Gundam no mesmo box.',
  'An extra booster that crosses the Gundam sagas in one box.',
  ['Eternal Nexus', 'EB01']
)

addTheme(
  'Character Premium Pack de I Don\'t Wanna Be a Dragon Girl, no festival da escola.',
  'A Character Premium Pack for I Don\'t Wanna Be a Dragon Girl, at the school festival.',
  ['I don\'t wanna be a Dragon Girl!']
)
addTheme(
  'Pack de reforço pelos 25 anos de Duel Masters, com cartas que ainda entram em mesa.',
  'A 25th-anniversary reinforcement pack for Duel Masters, with cards that still see play.',
  ['25 of Reinforcements']
)
addTheme(
  'Pack explosivo de Jashin, na linha Royal Road Double.',
  'An explosive Jashin pack, in the Royal Road Double line.',
  ['Jashin Explosive Duenamite Pack']
)
addTheme(
  'Black box de cards surpresa: o conteúdo não é escolhido à frente.',
  'A surprise-card black box: the contents are not chosen in advance.',
  ['Mysterious Black Box Pack']
)
addTheme(
  'Memorial de 20 anos, capítulo da alma. Reúne cartas importantes daquele recorte.',
  '20th-anniversary memorial, Soul Chapter. It gathers important cards from that cut.',
  ['20th Anniversary Memorial Pack Soul Chapter Best']
)
addTheme(
  'God of Abyss volume 2, com o dragão imperial em chamas.',
  'God of Abyss Vol. 2, with the burning dragon emperor.',
  ['轟炎の竜皇']
)
addTheme(
  'Abyss Revolution 2: ninjas do lado sombrio da honra.',
  'Abyss Revolution 2: ninjas on the dark side of honor.',
  ['Chaos Of Wicked Ninjas']
)
addTheme(
  'Memorial de 20 anos, capítulo das sombras (Parallel Masters).',
  '20th-anniversary memorial, shadow chapter (Parallel Masters).',
  ['Parallel Masters']
)
addTheme(
  'Memorial de 20 anos no teto da linha, com Dueking MAX.',
  '20th-anniversary memorial at the top of the line, with Dueking MAX.',
  ['The Chapter of The Ultimacy Dueking MAX']
)
addTheme(
  'Segunda carga de Invincible Soul, pack de ocupação de campo.',
  'Invincible Soul’s second charge, a field-occupation pack.',
  ['2nd Invincible Charge']
)
addTheme(
  'Memorial final dos Masters, encerrando aquela prateleira da linha.',
  'The Masters’ final memorial, closing that shelf of the line.',
  ['Master Final Memorial Pack']
)
addTheme(
  'Terceiro ato de Battle Galaxy, o Ultra Duel.',
  'Battle Galaxy’s third act, the Ultra Duel.',
  ['3rd Ultra Duel']
)
addTheme(
  'Memorial de 20 anos no caminho dos heróis, com cartas que ensinaram o jogo.',
  '20th-anniversary memorial on the heroes’ path, with cards that taught the game.',
  ["The Chapter of The Skills The Heroes' Way Perfect 20"]
)
addTheme(
  'Pack de entrada da linha de dragões.',
  'Entry pack for the dragon line.',
  ['Force Of Dragon Entry Pack']
)
addTheme(
  'Pack de entrada da linha de anjos.',
  'Entry pack for the angel line.',
  ['Perfect Angel Entry Pack']
)
addTheme(
  'Terceira geração cruzada de Evolution Saga, com o +1 Super no nome.',
  'Evolution Saga’s third cross generation, with +1 Super in the name.',
  ['3rd Cross Generation +1 Super']
)
addTheme(
  'CoroCoro Dream Pack 3, no tom de revista da linha Eternal Gear.',
  'CoroCoro Dream Pack 3, in the magazine tone of the Eternal Gear line.',
  ['CoroCoro Dream Pack 3 : Eternal Gear']
)
addTheme(
  'As 12 estratégias clássicas de Duel Masters, reunidas num quest pack.',
  'The 12 classic Duel Masters strategies, gathered in a quest pack.',
  ['~The Top 12 Legendary Strategies~']
)
addTheme(
  'Docking pack do Team Kirifuda com o Team Wave.',
  'A docking pack of Team Kirifuda with Team Wave.',
  ['Team Kirifuda & Team Wave']
)
addTheme(
  'Pack de estratégias avançadas da linha Draring.',
  'An advanced-strategy pack from the Draring line.',
  ['Super Powerful Strategies!! Draring Pack']
)

export function normalizeLiveRipThemeKey(value) {
  return normalizeThemeKey(value)
}

export function findLiveRipSetTheme({
  id = '',
  categoryId = '',
  setCode = '',
  setLabel = '',
  locale = 'pt-BR',
} = {}) {
  const localeKey = locale === 'en' ? 'en' : 'pt-BR'
  const candidates = [
    id,
    setLabel,
    categoryId && setCode ? `${categoryId}:${setCode}` : '',
    setCode,
  ]
  for (const candidate of candidates) {
    const theme = THEMES[normalizeThemeKey(candidate)]
    if (theme?.[localeKey]) return theme[localeKey]
  }
  return ''
}
