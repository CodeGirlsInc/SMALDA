import React, { useState } from 'react';

const NotificationToggles = () => {
  const [prefs, setPrefs] = useState({
    riskAlerts: true,
    verificationEmails: true,
    weeklyDigest: false,
  });

  const handleToggle = (key: keyof typeof prefs) => {
    setPrefs({ ...prefs, [key]: !prefs[key] });
  };

  const handleSave = async () => {
    try {
      await fetch('/api/user/notifications', {
        method: 'POST',
        body: JSON.stringify(prefs),
      });
      alert('Notification preferences saved!');
    } catch {
      alert('Error saving preferences.');
    }
  };

  return (
    <div className="settings-section">
      <h2>Notifications</h2>
      {Object.keys(prefs).map((key) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={prefs[key as keyof typeof prefs]}
            onChange={() => handleToggle(key as keyof typeof prefs)}
          />
          {key}
        </label>
      ))}
      <button onClick={handleSave}>Save Preferences</button>
    </div>
  );
};

export default NotificationToggles;
