import { motion, AnimatePresence } from 'framer-motion'

interface Achievement {
  id: number;
  agentName: string;
  message: string;
  timestamp: number;
}

interface AchievementBannerProps {
  achievements: Achievement[];
}

export function AchievementBanner({ achievements }: AchievementBannerProps) {
  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {achievements.map(a => (
          <motion.div
            key={a.id}
            className="px-6 py-2.5 rounded-lg text-center whitespace-nowrap"
            style={{
              background: 'linear-gradient(135deg, #78350f, #92400e, #78350f)',
              border: '2px solid #fbbf24',
              color: '#fbbf24',
              boxShadow: '0 0 20px rgba(251, 191, 36, 0.3), 0 0 40px rgba(251, 191, 36, 0.1)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
            initial={{ opacity: 0, y: -40, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <span className="mr-2">🏆</span>
            {a.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
