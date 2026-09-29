'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PacoBrowserApplication } from '@/composition/paco-browser-application';
import { speakPaco, startPacoRecognition } from './paco-voice';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export function usePacoChat(
  application: PacoBrowserApplication,
  voiceEnabled: boolean,
  refreshAlerts: (announce: boolean) => Promise<void>,
) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hola. Soy PACO. Puedo ayudarte con pedidos, colas, ocupación, actividades y pendientes.',
    },
  ]);
  const [wizard, setWizard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);

  function add(role: ChatMessage['role'], text: string) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role, text }]);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    add('user', message);
    setInput('');
    try {
      const reply = await application.paco.ask(message);
      if (reply.action === 'CANCEL') {
        setWizard(false);
        setMessages([{ id: crypto.randomUUID(), role: 'assistant', text: reply.text }]);
      } else add('assistant', reply.text);
      if (reply.action === 'START_ACTIVITY_WIZARD') setWizard(true);
      if (reply.action === 'NAVIGATE' && reply.href) router.push(reply.href);
      if (voiceEnabled && reply.text.length <= 320) speakPaco(reply.text);
      if (/resumen|cola|ocupad|dispon/i.test(message)) await refreshAlerts(false);
    } catch (error) {
      add('assistant', error instanceof Error ? error.message : 'No pude completar la consulta.');
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setWizard(false);
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: 'Consulta cancelada. Empecemos de nuevo.',
      },
    ]);
    setInput('');
  }

  function listen() {
    if (listening) return;
    setListening(true);
    const stop = startPacoRecognition(
      (text) => {
        setListening(false);
        setInput(text);
      },
      () => {
        setListening(false);
        add('assistant', 'No pude usar el micrófono. Puedes continuar escribiendo.');
      },
    );
    window.setTimeout(() => {
      stop();
      setListening(false);
    }, 12_000);
  }

  return {
    input,
    setInput,
    messages,
    wizard,
    setWizard,
    busy,
    listening,
    send,
    cancel,
    listen,
    add,
  };
}
