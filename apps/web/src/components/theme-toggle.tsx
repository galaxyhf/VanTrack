'use client';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from './ui/button';
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Alternar tema: sistema, claro ou escuro"
      title="Alternar tema"
      onClick={() => setTheme(theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system')}
    >
      {theme === 'dark' ? (
        <Moon size={19} />
      ) : theme === 'light' ? (
        <Sun size={19} />
      ) : (
        <Monitor size={19} />
      )}
    </Button>
  );
}
