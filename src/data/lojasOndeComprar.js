/** URLs de imagens Unsplash (w=1200 para boa qualidade no carrossel). */
const UNSPLASH = (id) => `https://images.unsplash.com/photo-${id}?w=1200&q=85&fit=crop&auto=format`

/**
 * Recomendações para o Quick Access na página Aonde comprar e Home.
 * Categorias pensadas para marketing, com imagens atraentes.
 * ids vinculam à página Onde Comprar (categoria=id).
 */
export const RECOMENDACOES_QUICK_ACCESS = [
  {
    id: 'anime',
    tipoLoja: 'Anime e cultura japonesa',
    imagem: '',
    imagens: ['/home/anime-1-figures.png', '/home/anime-2-unboxing-japanese.jpeg', '/home/anime-3-store.png'],
    lojaIds: ['amiami', 'goodsmile'],
    objetivoVisual: 'nostalgia + hype',
    estiloVisual: 'realista, paleta quente, enquadramento consistente',
    roteiroImagens: [
      'Coleção dos sonhos: prateleira com figures, posters e mangás (vibe quarto otaku).',
      'Unboxing japonês: caixa aberta com figure/chaveiro/snack e mão abrindo.',
      'Loja no Japão: interior estilizado cheio de produtos, referência Akihabara.',
    ],
    descricao: 'Figures, Nendoroids e merch oficial. Sua coleção merece o que há de melhor no Japão.',
  },
  {
    id: 'tcg',
    tipoLoja: 'Cards e colecionáveis',
    imagem: '',
    imagens: ['https://auctions.c.yimg.jp/images.auctions.yahoo.co.jp/image/dr000/auc0202/users/dfebff570644144f878ddd3c0212bba1fb2e74a9/i-img1200x823-17720300831609u5vj7.jpg', '/home/tcg-2-packs.png', '/home/tcg-1-japanese-booster-boxes-WLC.png', '/home/tcg-3-wstcg.jpg'],
    lojaIds: ['hareruya', 'magicamp'],
    objetivoVisual: 'valor + raridade',
    estiloVisual: 'realista, luz dirigida e foco no item',
    roteiroImagens: [
      'Cartas premium: close em cartas foil/holo com reflexo de luz.',
      'Deck organizado: cartas com sleeves e binder em visual limpo.',
      'Pull raro: mão segurando carta rara com fundo desfocado.',
    ],
    descricao: 'Pokémon, MTG, Weiss Schwarz e mais. Cards autênticos e colecionáveis que não chegam ao Brasil.',
  },
  {
    id: 'cosmeticos',
    tipoLoja: 'Cosméticos e beleza',
    imagem: '',
    imagens: ['/home/cosmeticos-1-comesticos.png', '/home/cosmeticos-2-cosmeticos.png', '/home/cosmeticos-3-livejapan.jpg'],
    lojaIds: ['cosme', 'qoo10', 'amazon'],
    objetivoVisual: 'confiança + qualidade japonesa',
    estiloVisual: 'clean premium (MUJI vibes), iluminação suave',
    roteiroImagens: [
      'Flat lay premium: skincare e maquiagem organizados.',
      'Rotina skincare: mão aplicando produto (uso real).',
      'Produtos populares do Japão: itens top vendidos alinhados.',
    ],
    descricao: 'Do Japão direto para você. Os melhores skincare e maquiagens que o mundo cobiça — envio seguro e consolidado.',
  },
  {
    id: 'usados',
    tipoLoja: 'Usados e raridades',
    imagem: '',
    imagens: ['/home/usados-1.jpg', '/home/usados-2.jpg', '/home/usados-3.jpg'],
    lojaIds: ['mercari', 'rakuma'],
    objetivoVisual: 'exclusividade + oportunidade',
    estiloVisual: 'realista com foco no produto e sensação de descoberta',
    roteiroImagens: [
      'Achado raro: item vintage/colecionável com fundo simples.',
      'Antes/depois: produto usado bem conservado.',
      'Garimpo no Japão: caixas/lojas de segunda mão.',
    ],
    descricao: 'Tesouros escondidos. Itens descontinuados, edições raras e pechinchas que só o Japão oferece.',
  },
  {
    id: 'stationery',
    tipoLoja: 'Papelaria e dia a dia',
    imagem: '',
    imagens: ['/home/stationery-1-upload.png', '/home/stationery-2-upload.png', '/home/stationery-3-fountain-pen.jpg'],
    lojaIds: ['loft', 'itoya', 'amazon'],
    objetivoVisual: 'fofura + utilidade',
    estiloVisual: 'realista com paleta suave e enquadramento padronizado',
    roteiroImagens: [
      'Mesa organizada: cadernos, canetas e washi tape em estilo minimal japonês.',
      'Detalhes kawaii: close em itens fofos, texturas e cores suaves.',
      'Uso real: pessoa escrevendo/estudando para conectar com a rotina.',
    ],
    descricao: 'Canetas, cadernos, planners e itens fofos de escritorio para o dia a dia, com selecao tematica inspirada no Japao.',
  },
]

/**
 * Lojas para a página Aonde comprar.
 * Adicione as imagens das logos em public/logos/ (120x120px mínimo).
 */
export const CATEGORIAS_LOJAS = [
  {
    id: 'gerais',
    nome: 'Produtos gerais',
    lojas: [
      { id: 'amazon', nome: 'Amazon', url: 'https://www.amazon.co.jp', descricao: 'Marketplace com ampla variedade de produtos do Japão.' },
      { id: 'rakuten', nome: 'Rakuten', url: 'https://www.rakuten.co.jp', descricao: 'Um dos maiores marketplaces do Japão com diversos vendedores.' },
      { id: 'loft', nome: 'Loft', url: 'https://www.loft.co.jp/store/', descricao: 'Rede japonesa com forte catálogo de stationery e itens do dia a dia.' },
      { id: 'muji', nome: 'MUJI', url: 'https://www.muji.com/jp/ja/store', descricao: 'Linha minimalista de utilidades, papelaria e rotina.' },
      { id: 'daiso', nome: 'Daiso', url: 'https://jp.daisonet.com', descricao: 'Loja 100 ienes com itens acessíveis de utilidade e rotina.' },
    ],
  },
  {
    id: 'stationery',
    nome: 'Stationery e Papelaria',
    lojas: [
      { id: 'itoya', nome: 'Itoya', url: 'https://www.ito-ya.co.jp/', descricao: 'Papelaria premium japonesa com grande variedade de canetas, cadernos, planners e itens de escritorio.' },
    ],
  },
  {
    id: 'cosmeticos',
    nome: 'Cosméticos e Beleza',
    lojas: [
      { id: 'cosme', nome: '@cosme', url: 'https://www.cosme.net', descricao: 'Maior referência de cosméticos no Japão, com rankings, reviews e compras.' },
      { id: 'qoo10', nome: 'Qoo10', url: 'https://www.qoo10.jp', descricao: 'Marketplace com variedade de cosméticos e ofertas em beleza.' },
    ],
  },
  {
    id: 'tcg',
    nome: 'Trading Card',
    lojas: [
      {
        id: 'hareruya',
        nome: 'Hareruya',
        descricao: 'Rede de lojas especializadas em TCG.',
        sites: [
          { nome: 'Hareruya (MTG)', url: 'https://www.hareruyamtg.com' },
          { nome: 'Hareruya 2 (Pokémon)', url: 'https://www.hareruya2.com' },
          { nome: 'Hareruya 3 (Duel Masters)', url: 'https://www.hareruya3.com' },
        ],
      },
      { id: 'yuyutei', nome: 'Yuyutei', url: 'https://yuyu-tei.jp', descricao: 'Cards de anime, Weiss Schwarz e jogos.' },
      { id: 'clove', nome: 'Clove', url: 'https://clove.jp/en', descricao: 'TCG, cards de anime e colecionáveis.' },
      { id: 'magicamp', nome: 'Magi', url: 'https://magi.camp', descricao: 'TCG, cards de anime e jogos.' },
      { id: 'cardrush', nome: 'Card Rush', url: 'https://www.cardrush.jp', descricao: 'Loja especializada em TCG e cards.' },
      { id: '193tcg', nome: '193 TCG', url: 'https://193tcg.com', descricao: 'TCG, cards e colecionáveis.' },
      { id: 'manzokuya', nome: 'Manzokuya', url: 'https://shopmanzokuya.com', descricao: 'Loja especializada em TCG e cards.' },
      { id: 'japantoreca', nome: 'Japan Toreca', url: 'https://japan-toreca.com', descricao: 'Crane games, gacha e prize figures.' },
      { id: 'toretoku', nome: 'Toretoku', url: 'https://www.toretoku.jp', descricao: 'Loja especializada em cards de TCG usados.' },
    ],
  },
  {
    id: 'anime',
    nome: 'Anime e Colecionáveis',
    lojas: [
      { id: 'amiami', nome: 'AmiAmi', url: 'https://www.amiami.com', descricao: 'Figures, Nendoroids, kits e itens de anime.' },
      { id: 'aniplex', nome: 'Aniplex', url: 'https://aniplexplus.com', descricao: 'Produtos oficiais Aniplex e licenciados.' },
      { id: 'pokemoncenter', nome: 'Pokemon Center', url: 'https://www.pokemoncenter-online.com', descricao: 'Produtos oficiais Pokémon exclusivos.' },
      { id: 'charaani', nome: 'Chara-ani', url: 'https://www.chara-ani.com', descricao: 'Figures, CDs e goods de anime e jogos.' },
      { id: 'kotobukiya', nome: 'Kotobukiya', url: 'https://shop.kotobukiya.co.jp/shop', descricao: 'Figures oficiais, Bishoujo e itens Kotobukiya.' },
      { id: 'hobbysearch', nome: 'Hobby Search', url: 'https://www.1999.co.jp', descricao: 'Plastic models, figures, hobby e colecionáveis.' },
      { id: 'goodsmile', nome: 'Good Smile', url: 'https://www.goodsmile.com/ja', descricao: 'Nendoroid, figma e produtos oficiais Good Smile.' },
      { id: 'junglescs', nome: 'Jungle SCS', url: 'https://jungle-scs-jpsale.jp', descricao: 'Colecionáveis, figures e hobby.' },
      { id: 'colleize', nome: 'Colleize', url: 'https://colleize.com', descricao: 'Marketplace de figures, anime goods e colecionáveis.' },
      { id: 'lashinbang', nome: 'Lashinbang', url: 'https://shop.lashinbang.com', descricao: 'Anime, manga, figures e itens usados.' },
      { id: 'sofmap', nome: 'Sofmap', url: 'https://www.sofmap.com', descricao: 'Eletrônicos, PCs, games, figures e colecionáveis.' },
    ],
  },
  {
    id: 'personagens',
    nome: 'Personagens e Licenças',
    lojas: [
      { id: 'sanrio', nome: 'Sanrio', url: 'https://www.sanrio.co.jp', descricao: 'Hello Kitty, My Melody e personagens Sanrio.' },
      { id: 'studioghibli', nome: 'Studio Ghibli', url: 'https://www.donguri-sora.com', descricao: 'Produtos oficiais Studio Ghibli.' },
    ],
  },
  {
    id: 'usados',
    nome: 'Usados e Leilões',
    lojas: [
      { id: 'mandarake', nome: 'Mandarake', url: 'https://order.mandarake.co.jp', descricao: 'Itens usados de anime, manga e hobby.' },
      { id: 'surugaya', nome: 'Suruga-ya', url: 'https://www.suruga-ya.jp', descricao: 'Manga, anime, figures e itens usados de colecionáveis.' },
      { id: 'rakuma', nome: 'Rakuma', url: 'https://fril.jp', descricao: 'Marketplace de usados do Japão.' },
      { id: 'mercari', nome: 'Mercari', url: 'https://jp.mercari.com', descricao: 'Compra e venda de usados entre pessoas.' },
      { id: 'yahoofleamarket', nome: 'Yahoo Fleamarket', url: 'https://auctions.yahoo.co.jp', descricao: 'Leilões e itens usados Yahoo Japan.' },
      { id: 'hardoff', nome: 'Off Mall', url: 'https://netmall.hardoff.co.jp', descricao: 'Eletrônicos, games e itens usados Hard Off.' },
      { id: 'okoku', nome: 'Kaitori Okoku', url: 'https://www.okoku.jp/ec/index1.html', descricao: 'Itens usados e recondicionados.' },
      { id: 'ragtag', nome: 'Ragtag', url: 'https://www.ragtag.jp', descricao: 'Roupas e acessórios de luxo usados.' },
      { id: 'closetchild', nome: 'Closet Child', url: 'https://www.closetchildonlineshop.com', descricao: 'Moda lolita, anime style e usados.' },
    ],
  },
  {
    id: 'moda',
    nome: 'Moda',
    lojas: [
      { id: 'uniqlo', nome: 'Uniqlo', url: 'https://www.uniqlo.com/jp', descricao: 'Roupas casuais e colaborações exclusivas.' },
      { id: 'snkrdunk', nome: 'SNKRDUNK', url: 'https://snkrdunk.com', descricao: 'Streetwear e sneakers japonesas.' },
      { id: 'minne', nome: 'Minne', url: 'https://minne.com', descricao: 'Moda, artesanato e itens feitos à mão.' },
      { id: 'voi', nome: 'Marui', url: 'https://voi.0101.co.jp/voi', descricao: 'Loja de departamento Marui — moda e lifestyle.' },
      { id: 'palcloset', nome: 'Pal Closet', url: 'https://www.palcloset.jp', descricao: 'Roupas de luxo e designer.' },
    ],
  },
]
