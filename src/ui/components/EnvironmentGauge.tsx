'use client';
import { WaterDrop, Thermostat } from '@mui/icons-material';

interface EnvironmentGaugeProps {
  humidity: number;
  temp: number;
}

export function EnvironmentGauge({ humidity, temp }: EnvironmentGaugeProps) {
  return (
    <div className="env-row">
      <div className="env-gauge">
        <WaterDrop />
        <div>
          <div className="env-gauge-label">Humidity</div>
          <div className="env-gauge-value">{humidity}%</div>
          <div className="env-gauge-bar">
            <div className="env-gauge-fill blue" style={{ width: `${humidity}%` }} />
          </div>
        </div>
      </div>
      <div className="env-gauge">
        <Thermostat />
        <div>
          <div className="env-gauge-label">Temperature</div>
          <div className="env-gauge-value">{temp}°C</div>
          <div className="env-gauge-bar">
            <div className="env-gauge-fill orange" style={{ width: `${(temp / 35) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
