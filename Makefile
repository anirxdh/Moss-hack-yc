# Convenience commands for the battle-pack
# Usage:  make view   (serve the interactive explainer)

PORT ?= 4321

view: ## Serve the interactive "Anatomy of an AI Phone Rep" explainer
	@echo "🎙️  Serving the explainer at  http://localhost:$(PORT)"
	@echo "    (press Ctrl+C to stop)"
	@cd site && python3 -m http.server $(PORT) --bind 127.0.0.1

open: ## Just open the self-contained page directly (no server needed)
	@open site/index.html

.PHONY: view open
