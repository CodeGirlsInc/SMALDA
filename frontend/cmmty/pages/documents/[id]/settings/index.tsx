import React from 'react';
import SettingsForm from './SettingsForm';
import NotificationToggles from './NotificationToggles';
import ChangePassword from './ChangePassword';

const SettingsPage = () => {
  return (
    <div className="settings-container">
      <h1>User Profile Settings</h1>
      <SettingsForm />
      <NotificationToggles />
      <ChangePassword />
    </div>
  );
};

export default SettingsPage;
