/**
 * v1.3.x — Mila Brew Chat panel.
 *
 * A right-docked conversational drawer for Thousand-Year Storm. Opened by the
 * "CHAT WITH MILA" button on the deck editor (gated on a commander being set
 * + the user being signed in). The user types natural-language requests; Mila
 * replies with prose and optional approve-able adds/cuts that commit to the
 * deck atomically via $store.deckgenChat.applyChanges().
 *
 * All state lives in the deckgenChat store; this x-data only holds the
 * send-on-enter helper and the auto-scroll effect. Style matches
 * deckgen-review-screen.js / deckgen-brew-modal.js (Neo-Occult tokens).
 *
 * Injection is safe: this is a static template — every dynamic value comes
 * from the store through Alpine bindings (no user input is interpolated into
 * the HTML string).
 */

export function renderDeckgenChatPanel() {
  return `
    <div
      x-data="{
        scrollDown() {
          this.$nextTick(() => {
            const el = this.$refs.scrollArea;
            if (el) el.scrollTop = el.scrollHeight;
          });
        },
        onKey(e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.send();
          }
        },
        async send() {
          await $store.deckgenChat.sendMessage();
          this.scrollDown();
        },
        async apply(idx) {
          await $store.deckgenChat.applyChanges(idx);
        }
      }"
      x-show="$store.deckgenChat?.panelOpen"
      x-effect="$store.deckgenChat?.messages.length, $store.deckgenChat?.status, scrollDown()"
      x-cloak
      @keydown.escape.window="$store.deckgenChat.closeChat()"
      style="position: fixed; inset: 0; z-index: 9000; display: flex; justify-content: flex-end;"
    >
      <!-- Backdrop -->
      <div
        @click="$store.deckgenChat.closeChat()"
        style="position: absolute; inset: 0; background: rgba(11,12,16,0.6);"
      ></div>

      <!-- Drawer -->
      <div
        @click.stop
        style="position: relative; z-index: 10; width: 100%; max-width: 440px; height: 100%; background: #14161C; border-left: 1px solid #2A2D3A; display: flex; flex-direction: column;"
      >
        <!-- Header -->
        <div style="flex-shrink: 0; padding: 20px 24px; border-bottom: 1px solid #2A2D3A; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
            <span class="material-symbols-outlined" style="color: #0D52BD; font-size: 24px;">forum</span>
            <div style="min-width: 0;">
              <h2 style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE; margin: 0; text-transform: uppercase; letter-spacing: 0.01em;">BREW WITH MILA</h2>
              <div
                style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; color: #7A8498; text-transform: uppercase; margin-top: 2px;"
                x-text="$store.deckgenChat?.budgetRemaining !== null ? ($store.deckgenChat.budgetRemaining + ' CHATS LEFT TODAY') : 'CONVERSATIONAL DECKBUILDING'"
              ></div>
            </div>
          </div>
          <button
            @click="$store.deckgenChat.closeChat()"
            aria-label="Close chat"
            style="background: transparent; border: none; color: #7A8498; cursor: pointer; padding: 4px; flex-shrink: 0;"
          >
            <span class="material-symbols-outlined" style="font-size: 20px;">close</span>
          </button>
        </div>

        <!-- Message list -->
        <div x-ref="scrollArea" style="flex: 1; min-height: 0; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 16px;">

          <!-- Empty / intro state -->
          <template x-if="($store.deckgenChat?.messages.length || 0) === 0">
            <div style="margin: auto 0; text-align: center; padding: 24px 8px;">
              <span class="material-symbols-outlined" style="font-size: 40px; color: #2A2D3A;">pets</span>
              <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #7A8498; line-height: 1.5; margin: 12px 0 0;">
                Tell us what you want. Try <em>"more removal"</em>, <em>"cut the slow ramp"</em>, <em>"lean spellslinger"</em>, or ask <em>"why Sol Ring?"</em>. Proposed changes are yours to approve before they touch the deck.
              </p>
            </div>
          </template>

          <template x-for="(msg, idx) in $store.deckgenChat?.messages" :key="idx">
            <div>
              <!-- USER bubble -->
              <template x-if="msg.role === 'user'">
                <div style="display: flex; justify-content: flex-end;">
                  <div style="max-width: 85%; padding: 10px 14px; background: rgba(13,82,189,0.15); border: 1px solid rgba(13,82,189,0.4); color: #EAECEE; font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.45;" x-text="msg.text"></div>
                </div>
              </template>

              <!-- MILA bubble -->
              <template x-if="msg.role === 'assistant'">
                <div style="display: flex; flex-direction: column; gap: 10px; align-items: flex-start;">
                  <!-- Prose reply -->
                  <div style="max-width: 92%; padding: 10px 14px; background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE; font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5;" x-text="msg.reply"></div>

                  <!-- Proposed changes -->
                  <template x-if="(msg.adds.length + msg.cuts.length) > 0">
                    <div style="width: 100%; display: flex; flex-direction: column; gap: 8px; padding: 12px; background: #0B0C10; border: 1px solid #2A2D3A;">

                      <!-- Cuts (OUT) -->
                      <template x-for="row in msg.cuts" :key="'cut-' + row.scryfall_id">
                        <div
                          @click="!msg.applied && $store.deckgenChat.toggleChange(idx, 'cuts', row.scryfall_id)"
                          :style="(row.approved
                            ? 'border: 1px solid rgba(226,56,56,0.5); background: rgba(226,56,56,0.06);'
                            : 'border: 1px solid #2A2D3A; opacity: 0.5;') + ' padding: 8px 10px; ' + (msg.applied ? '' : 'cursor: pointer;')"
                        >
                          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                            <span style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                              <span style="font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.12em; color: #E23838; text-transform: uppercase; flex-shrink: 0;">OUT</span>
                              <span style="font-family: 'Space Grotesk', sans-serif; font-size: 13px; color: #EAECEE; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" x-text="row.name"></span>
                            </span>
                            <span
                              x-show="!msg.applied"
                              :style="(row.approved
                                ? 'background: rgba(226,56,56,0.15); color: #E23838; border: 1px solid #E23838;'
                                : 'background: transparent; color: #7A8498; border: 1px solid #2A2D3A;') + ' flex-shrink: 0; padding: 2px 6px; font-family: JetBrains Mono, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;'"
                              x-text="row.approved ? 'CUT' : 'KEEP'"
                            ></span>
                          </div>
                          <span x-show="row.reasoning" style="display: block; font-family: 'Space Grotesk', sans-serif; font-size: 12px; color: #7A8498; line-height: 1.4; margin-top: 4px;" x-text="row.reasoning"></span>
                        </div>
                      </template>

                      <!-- Adds (IN) -->
                      <template x-for="row in msg.adds" :key="'add-' + row.scryfall_id">
                        <div
                          @click="!msg.applied && $store.deckgenChat.toggleChange(idx, 'adds', row.scryfall_id)"
                          :style="(row.approved
                            ? 'border: 1px solid rgba(46,204,113,0.5); background: rgba(46,204,113,0.06);'
                            : 'border: 1px solid #2A2D3A; opacity: 0.5;') + ' padding: 8px 10px; ' + (msg.applied ? '' : 'cursor: pointer;')"
                        >
                          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                            <span style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                              <span style="font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.12em; color: #2ECC71; text-transform: uppercase; flex-shrink: 0;">IN</span>
                              <span style="font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700; color: #EAECEE; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" x-text="row.name"></span>
                              <span style="font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.1em; color: #4A5064; text-transform: uppercase; flex-shrink: 0;" x-text="(row.role || '').replace(/_/g, ' ')"></span>
                            </span>
                            <span
                              x-show="!msg.applied"
                              :style="(row.approved
                                ? 'background: rgba(46,204,113,0.15); color: #2ECC71; border: 1px solid #2ECC71;'
                                : 'background: transparent; color: #7A8498; border: 1px solid #2A2D3A;') + ' flex-shrink: 0; padding: 2px 6px; font-family: JetBrains Mono, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;'"
                              x-text="row.approved ? 'ADD' : 'SKIP'"
                            ></span>
                          </div>
                          <span x-show="row.reasoning" style="display: block; font-family: 'Space Grotesk', sans-serif; font-size: 12px; color: #7A8498; line-height: 1.4; margin-top: 4px;" x-text="row.reasoning"></span>
                        </div>
                      </template>

                      <!-- Apply / applied footer -->
                      <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 2px;">
                        <template x-if="msg.applied">
                          <span style="display: inline-flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: #2ECC71; text-transform: uppercase;">
                            <span class="material-symbols-outlined" style="font-size: 16px;">check_circle</span> APPLIED
                          </span>
                        </template>
                        <template x-if="!msg.applied">
                          <button
                            @click="apply(idx)"
                            :disabled="$store.deckgenChat.approvedCount(idx) === 0"
                            :style="$store.deckgenChat.approvedCount(idx) > 0
                              ? 'padding: 6px 14px; background: #0D52BD; color: #EAECEE; border: 1px solid #0D52BD; cursor: pointer; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;'
                              : 'padding: 6px 14px; background: #1C1F28; color: #4A5064; border: 1px solid #2A2D3A; cursor: not-allowed; opacity: 0.6; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;'"
                            x-text="'APPLY (' + $store.deckgenChat.approvedCount(idx) + ')'"
                          ></button>
                        </template>
                      </div>
                    </div>
                  </template>
                </div>
              </template>
            </div>
          </template>

          <!-- Thinking indicator -->
          <template x-if="$store.deckgenChat?.status === 'thinking'">
            <div style="display: flex; align-items: center; gap: 8px; color: #7A8498; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;">
              <span class="material-symbols-outlined" style="font-size: 16px; color: #0D52BD;">pets</span> MILA IS THINKING…
            </div>
          </template>
        </div>

        <!-- Error banner -->
        <template x-if="$store.deckgenChat?.status === 'error' && $store.deckgenChat?.error">
          <div style="flex-shrink: 0; padding: 10px 24px; background: rgba(226,56,56,0.1); border-top: 1px solid rgba(226,56,56,0.4); color: #E23838; font-family: 'Space Grotesk', sans-serif; font-size: 13px;" x-text="$store.deckgenChat.error.message"></div>
        </template>

        <!-- Composer -->
        <div style="flex-shrink: 0; padding: 16px 24px; border-top: 1px solid #2A2D3A; display: flex; gap: 8px; align-items: flex-end;">
          <textarea
            x-model="$store.deckgenChat.input"
            @keydown="onKey($event)"
            :disabled="$store.deckgenChat?.status === 'thinking' || $store.deckgenChat?.budgetExhausted"
            rows="2"
            placeholder="Ask to tweak your deck…"
            style="flex: 1; resize: none; background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 10px 12px; font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.4; outline: none;"
            onfocus="this.style.borderColor='#0D52BD'"
            onblur="this.style.borderColor='#2A2D3A'"
          ></textarea>
          <button
            @click="send()"
            :disabled="$store.deckgenChat?.status === 'thinking' || !($store.deckgenChat?.input || '').trim() || $store.deckgenChat?.budgetExhausted"
            :style="($store.deckgenChat?.status !== 'thinking' && ($store.deckgenChat?.input || '').trim() && !$store.deckgenChat?.budgetExhausted)
              ? 'padding: 12px; background: #0D52BD; color: #EAECEE; border: 1px solid #0D52BD; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;'
              : 'padding: 12px; background: #1C1F28; color: #4A5064; border: 1px solid #2A2D3A; cursor: not-allowed; opacity: 0.6; display: inline-flex; align-items: center; justify-content: center;'"
            aria-label="Send"
          >
            <span class="material-symbols-outlined" style="font-size: 20px;">send</span>
          </button>
        </div>
      </div>
    </div>
  `;
}
