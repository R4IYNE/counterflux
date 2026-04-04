/**
 * Welcome screen -- search landing page.
 * This is the default screen when the app loads.
 */
export function mount(container) {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center min-h-[60vh] gap-lg">
      <h1 class="font-header text-5xl font-bold text-text-primary tracking-tight" style="font-size: 48px; line-height: 1.1; letter-spacing: -0.02em;">
        Welcome to the Aetheric Archive
      </h1>
      <div class="flex items-center gap-md">
        <img src="/assets/assetsmila-izzet.png" alt="Mila -- Izzet Familiar" class="w-16 h-16 rounded-full object-cover" style="filter: saturate(0.8);">
        <p class="font-body text-text-muted" style="font-size: 14px; line-height: 1.5; max-width: 480px;">
          Mila here! Your card database is ready. Start typing a card name above to search
          <span x-text="$store.bulkdata?.totalCards?.toLocaleString() || '...'"></span> cards.
        </p>
      </div>
    </div>
  `;
}
