# Calculadora de final para estudantes da UESC

Site estático, responsivo e sem dependências. Ferramenta independente: os critérios iniciais (aprovação direta 7, mínimo para final 3 e média pós-final 5) são uma simulação ajustável, ainda sem confirmação em fonte oficial. Fórmula: `(média do semestre + nota da final) / 2`. A frequência não é calculada. Nenhum dado é enviado a um servidor.

## Desenvolvimento

Na pasta `/workspace/chat-gpt`, execute `python3 -m http.server 3000 --bind 0.0.0.0`. Testes: `node --test calculator.test.mjs`. Não há instalação de pacotes. O site funciona sem fontes externas; o visual usa fontes do sistema se Google Fonts estiver indisponível.

## Publicação

O workflow `.github/workflows/pages.yml` testa e publica a branch `main` no GitHub Pages. É necessário habilitar **Settings → Pages → Source → GitHub Actions** no repositório. O endereço público só estará disponível após a execução bem-sucedida do workflow.
