# Distribuição futura do LUAR

O LUAR já possui manifesto, service worker, ícones de 180, 192 e 512 pixels, navegação responsiva e página pública de instalação em `https://luarhub.site/instalar`.

## Google Play Store

Use um Trusted Web Activity (TWA) ou uma ferramenta compatível com PWA. Antes de gerar o pacote, publique `/.well-known/assetlinks.json` com a impressão digital do certificado de assinatura fornecida pela conta da loja. Revise política de privacidade, classificação etária, ficha de segurança de dados e capturas reais. Nenhum pacote deve ser publicado sem validação humana.

## Microsoft Store

Use o PWABuilder com `https://luarhub.site/manifest.json`. Revise nome, descrição, ícones, capturas, política de privacidade e identificadores da conta Microsoft antes de enviar.

## Itens que dependem das contas das lojas

- conta de desenvolvedor e identidade legal;
- certificado e chaves de assinatura;
- IDs definitivos dos aplicativos;
- capturas aprovadas e textos das fichas;
- questionários de privacidade e classificação;
- revisão e publicação manual.
