<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## ZASADA DEPLOYMENTU NA PRODUKCJĘ
- NIE wypychaj zmian na produkcję (`git push origin main` / `npx convex deploy`) automatycznie po zakończeniu zadania.
- Wypychaj zmiany na produkcję WYŁĄCZNIE wtedy, gdy użytkownik wyraźnie o to poprosi (np. "wypchnij na produkcję", "deploy").

## ZASADA TESTÓW AUTOMATYCZNYCH
- Do każdego zadania, które wprowadza zmiany w bazie danych (np. nowe pola, tabele, mutacje/funkcje modyfikujące baze danych), NALEŻY napisać test automatyczny / weryfikacyjny (np. skrypt testowy lub funkcję testującą w Convex/Vitest/Node) i uruchomić go, aby upewnić się, że zapis i odczyt z bazy działają poprawnie.
