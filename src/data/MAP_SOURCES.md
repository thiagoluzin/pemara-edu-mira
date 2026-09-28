# Base cartográfica

`world-land.json` deriva de Natural Earth, Admin 0 Countries, escala 1:110 milhões (domínio público). Coordenadas geográficas arredondadas a três casas; fronteiras generalizadas contemporâneas, não fronteiras históricas nem zoneamento climático.

Fonte: https://www.naturalearthdata.com/about/terms-of-use/
GeoJSON: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson

`scripts/prepare-map-data.mjs` gera os anéis simplificados a partir da cópia `world-source.geojson`. O sistema inclui a base no pacote e funciona sem internet.

Os exemplos de clima usam localidades de referência, não polígonos nem limites de classificação. Base conceitual para consulta: Atlas Geográfico Escolar do IBGE, seção Clima: https://atlasescolar.ibge.gov.br/
