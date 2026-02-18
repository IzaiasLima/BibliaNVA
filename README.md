# Bíblia NVA

## Apresentação
Este site/aplicativo reproduz o texto da tradução da [Bíblia Nova Versão de Acesso Livre (NVA)](https://www.biblianva.com.br/) que é disponibilizado para acesso livre por meio da licença [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/).

## Motivação
Dado que exite o [site oficial da Bíblia NVA](https://www.biblianva.com.br/), por que este projeto seria necessário?

**Por dois motivos:**

1. O site oficial não é otimizado para o uso em telas pequenas. Como mais de 60% das pessoas, no Brasil, acessam a Web apenas por meio do celular (além daqueles que usam mais de uma forma de acesso), me propus a espelhar o conteúdo oficial da Bíblia NVA nesta aplicação PWA, que proporcionará uma experiência melhor para esses usuários.

2. Permitir que o texto seja consultado por meio de uma API. Ainda que não tenha a pretensão de ser um local de consultas massivas, pois não poderia dar conta de um tráfego intenso, considero relevante oferecer a possibilidade desse tipo acesso para esta valiosa versão do texto bíblico.

## Adaptação textual
Ao longo da vida tive mais contato e familiaridade com as versões baseadas na Almeida, por isso, certas expressões em que Yahweh é usado na presente versão, como Yahweh é o meu pastor" ou "Yahweh dos Exércitos" soam bastante estranhas. Sendo assim, optei por utilizar, em seu lugar, o título Senhor, em versalete, como na maioria das versões mais tradicionais. Adotei esse procedimento apenas para algumas dessas expressões, mantendo o nome sagrado Yahweh nos demais casos.

Por conveniência e praticidade para o público deste aplicativo, eliminamos a maioria das notas de rodapé, deixando o texto mais limpo e mais fluido. Aos estudantes e demais interessados em uma análise mais aprofudada do texto, recomendamos acessar o conteúdo em sua forma original diretamente no site oficial da Bíblia NVA.

A versão do texto que adotamos neste projeto é a que estava disponível nos repositórios oficiais em 02/02/2026.

## Consultas à API

As consulta à API desta aplicação deve ser feita nos seguintes _endpoints_:

**/api** lista dos livros

**/api/{book}** lista dos capítulos de um livro, onde {book} é a sigla do livro (exemplo: Mt, 1Co).

**/api/{book}/{chapter}** lista de todos os versículos do capítulo, onde {chapter} é o número do capítulo.

**/api/{book}/{chapter}/{verses}** para acessar um ou mais versículos, onde {verses} é o número de um versículo ou uma lista de versículos.

Exemplos: [/api/jó/1/22](https://biblia.izaias.com.br/api/jó/1/22); [/api/jo/14/1-3](https://biblia.izaias.com.br/api/jo/14/1-3); [/api/jo/14/1,2,3,18](https://biblia.izaias.com.br/api/jo/14/1,2,3,18).


## Termos de Uso
Este serviço é gratuito, disponível para uso por qualquer pessoa, desde que não haja abuso em sua utlização. O serviço tem um limite de requisições por segundo, portanto não use esta API para baixar a Bíblia inteira. Em vez disso, obtenha os dados da fonte original, informada no site oficial da NVA. Também não use os nossos endpoints como backend para uma aplicação que tenha alta demanda de acessos.

Não há garantia de disponibilidade, qualidade ou a corretude deste serviço. O serviço pode ficar fora do ar ocasionalmente, pois é disponibilizado apenas como um hobby. O código e os dados deste site/aplicativo estão disponíveis neste repositório, caso prefira hospedá-lo você mesmo.

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

Recomendo fazer as correções necessárias antes de executar o script de conversão. Se tiver que repetir o processo, sugiro _dropar_ a tabela _bible_ para não ter problemas com a chave primária. O excesso de erros exibidos, devido à duplicação de chaves, poderia mascarar outros problemas de importação.
