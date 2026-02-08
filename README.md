# Bíblia NVA

## Apresentação
Este site/aplicativo reproduz o texto da tradução da [Bíblia Nova Versão de Acesso Livre (NVA)](https://www.biblianva.com.br/) que é disponibilizado para acesso livre por meio da licença [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/).

## Motivação
Dado que exite o [site oficial da Bíblia NVA](https://www.biblianva.com.br/), por que este projeto seria necessário?

**Por dois motivos:**

1. O site oficial não é otimizado para o uso em telas pequenas. Como [mais de 60% das pessoas](https://www.nic.br/noticia/na-midia/celular-e-unico-meio-de-acesso-para-62-dos-usuarios-de-internet-no-brasil/), no Brasil, acessam a Web apenas por meio do celular (além daqueles que usam mais de uma forma de acesso), me propus a espelhar o conteúdo oficial da Bíblia NVA em uma aplicação PWA, que proporcionará uma experiência melhor para esses usuários.

2. Permitir que o texto seja consultado por meio de uma API. Ainda que não tenha a pretensão de ser um local de consultas massivas, pois não poderia dar conta de um tráfego intenso, considero relevante oferecer a possibilidade desse tipo acesso para esta valiosa versão do texto bíblico.


## Consultas à API

As consulta à API desta aplicação deve ser feita nos seguintes endpoints:

**/api** para a lista dos livros

**/api/{book}** para a lista dos capítulos de um livro, onde {book} é a sigla do livro ( exemplo: Mt, 1Co).

**/api/{book}/{chapter}** para a lista de todos versículos do capítulo, onde {chapter} é o número do capítulo.

**/api/{book}/{chapter}/{verses}** para acessar um ou mais versículos, onde /{verses} é o número de um versículo ou uma lista de versículos.

Exemplos: [/api/jó/1/22](https://biblia.izaias.com.br/api/jó/1/22); [/api/jo/14/1-3](https://biblia.izaias.com.br/api/jo/14/1-3); [/api/jo/14/1,2,3,18](https://biblia.izaias.com.br/api/jo/14/1,2,3,18).


## Termos de Uso
Este serviço é gratuito, disponível para uso por qualquer pessoa, desde que não haja abuso em sua utlização. O serviço tem um limite de requisições por segundo, portanto não use esta API para baixar a Bíblia inteira. Em vez disso, obtenha os dados da fonte original, informada no site oficial da NVA. Também não use os nossos endpoints como backend para uma aplicação que tenha alta demanda de acessos.

Não há garantia de disponibilidade, qualidade ou a corretude deste serviço. O serviço pode ficar fora do ar ocasionalmente, pois é disponibilizado apenas como um hobby. O código e os dados deste site/aplicativo estão disponíveis no repositário do GitHub, caso você mesmo prefira hospedá-lo.

## Processamento dos arquivos

**Baixe os arquivos fontes do GitHub**

Execute o comando ```getgit.sh``` existente na pasta ```sources``` para clonar os repositórios contendo os arquivos.

```shell
./getgit.sh
```
Após ter concluído a clonagem dos repositórios, converta os arquivos para o banco de dados Sqlite com o seguinte comando:

```shell
python3 convert.py
```

**Foram detectados os seguintes problemas na importação dos dados:**

1. Coríntios não estava acentuado no arquivo _title.txt_. Precisou ser acentuado corretamente para que o _script_ conseguisse reconhecer os dados. Isso aconteceu também com Miquéias e Oséias. Um problema similar aconteceu com Levítico, que estava grafado como _Levíticos_, no plural, e também precisou ser corrigido no arquivo _title.txt_.

2. Havia ambém algums versos com problemas de formatação, com o número do versículo colado no texto ou com dois números de versículos seguidos, e na ordem inversa (exemplo: \\v 23 \\v 22 ...), em 1 e 2 Crônicas. O problema apareceu também em 1 Samuel, em Jó e em Salmos. Nestes casos, bastou excluir o número incorreto ou adicionar o espaço faltante entre o número e o texto, e salvar o arquivo novamente.

3. Em algums textos há uma quebra de linha não prevista que ocasiona um erro não detectado no processamento. É necessário eliminar esse problema antes do processamento ou excluir o livro todo da base de dados e reprocessar a penas esse livro. Esse tipo de problema se encontra em Êxodo, capítulos 13, verso 13, capítulo 14, verso 12, capítulo 25, verso 30 e capítulo 39, verso 3; em Deutoronômio, capítulo 1, verso 21 e capítulo 15, verso 14; também em 2 Crônicas, capítulos 16, versos 12 e 13, e Capítulo 29, verso 9; em 1 Samuel, capítulos 9, verso 19 e capítulo 28, verso 19; e em Jeremias, capítulo 23, verso 36. 

Recomendo executar o script uma vez para localizar os problemas. Fazer as correções necessárias e, antes de executar o script novamete, zerar a tabela _bible_ para não ter problemas com a duplicação de chaves, que poderia mascarar outros problemas de importação.
