import { useEffect, useState, useRef } from 'react';

const stats = [
  { value: 950, suffix: '+', label: 'Placements' },
  { value: 98, suffix: '%', label: 'Client Retention' },
  { value: 30, suffix: '+', label: 'Years of Experience' },
];

const useCountUp = (end: number, duration: number = 2000, start: boolean = false) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (!start) return;
    
    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [end, duration, start]);
  
  return count;
};

export const Stats = () => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-20">
      <div ref={ref} className="container mx-auto px-6">
        <div className="bg-gradient-card rounded-3xl border border-border p-12 md:p-16">
          <div className="grid grid-cols-3 gap-12">
            {stats.map((stat, index) => (
              <StatItem key={stat.label} stat={stat} isVisible={isVisible} delay={index * 100} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const StatItem = ({ 
  stat, 
  isVisible, 
  delay 
}: { 
  stat: typeof stats[0]; 
  isVisible: boolean; 
  delay: number;
}) => {
  const count = useCountUp(stat.value, 2000, isVisible);
  
  return (
    <div 
      className="text-center"
      style={{ 
        animationDelay: `${delay}ms`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: `all 0.6s ease-out ${delay}ms`
      }}
    >
      <div className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-gradient-gold mb-2">
        {count}{stat.suffix}
      </div>
      <p className="text-muted-foreground font-medium">{stat.label}</p>
    </div>
  );
};
