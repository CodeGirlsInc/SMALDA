import React, { useState } from 'react';

const SettingsForm = () => {
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      // API call to save profile
      await fetch('/api/user/update', {
        method: 'POST',
        body: JSON.stringify({ fullName }),
      });
      alert('Profile updated successfully!');
    } catch (err) {
      alert('Error updating profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-section">
      <h2>Personal Information</h2>
      <input
        type="text"
        placeholder="Full Name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <button onClick={handleSave} disabled={loading}>
        {loading ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
};

export default SettingsForm;
