import React, { useState } from 'react';

const ChangePassword = () => {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');

  const handleChange = async () => {
    try {
      await fetch('/api/user/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPass, newPass }),
      });
      alert('Password changed successfully!');
    } catch {
      alert('Error changing password.');
    }
  };

  return (
    <div className="settings-section">
      <h2>Change Password</h2>
      <input
        type="password"
        placeholder="Old Password"
        value={oldPass}
        onChange={(e) => setOldPass(e.target.value)}
      />
      <input
        type="password"
        placeholder="New Password"
        value={newPass}
        onChange={(e) => setNewPass(e.target.value)}
      />
      <button onClick={handleChange}>Update Password</button>
    </div>
  );
};

export default ChangePassword;
