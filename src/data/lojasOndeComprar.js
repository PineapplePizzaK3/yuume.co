/**
 * Lojas para a página Aonde comprar.
 * Adicione as imagens das logos em public/logos/ (120x120px mínimo).
 */
export const CATEGORIAS_LOJAS = [
  {
    id: 'ecommerce',
    nome: 'E-commerce e Marketplaces',
    lojas: [
      { id: 'amazon', nome: 'Amazon', url: 'https://www.amazon.co.jp', descricao: 'Marketplace com ampla variedade de produtos do Japão.' },
      { id: 'rakuten', nome: 'Rakuten', url: 'https://www.rakuten.co.jp', descricao: 'Um dos maiores marketplaces do Japão com diversos vendedores.' },
      { id: 'qoo10', nome: 'Qoo10', url: 'https://www.qoo10.jp', descricao: 'E-commerce com descontos e cupons frequentes.' },
      { id: 'daiso', nome: 'Daiso', url: 'https://jp.daisonet.com', descricao: 'Loja 100 ienes — itens de utilidade, decoração e presentes.' },
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
