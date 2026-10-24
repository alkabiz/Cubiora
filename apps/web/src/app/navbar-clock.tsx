import { memo, useEffect, useState } from 'react';

const timeFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export const NavbarClock = memo(function NavbarClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const timeText = timeFormatter.format(now);

  return (
    <time
      className="app-navbar-clock"
      dateTime={now.toISOString()}
      aria-label={`Hora local actual: ${timeText}`}
    >
      Hoy · {timeText}
    </time>
  );
});
