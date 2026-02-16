import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';
import { Notification, NotificationType } from '../hooks/useNotifications';

interface ToastNotificationProps {
  notification: Notification;
  onDismiss: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  notification,
  onDismiss
}) => {
  // Fechar automaticamente após 10 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 10000); // 10 segundos

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
      case 'info':
        return <Info className="w-6 h-6 text-blue-500" />;
      default:
        return <Info className="w-6 h-6 text-gray-500" />;
    }
  };

  const getBgColor = (type: NotificationType) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-500';
      case 'success':
        return 'bg-green-50 border-green-500';
      case 'warning':
        return 'bg-yellow-50 border-yellow-500';
      case 'info':
        return 'bg-blue-50 border-blue-500';
      default:
        return 'bg-gray-50 border-gray-500';
    }
  };

  return (
    <div className={`fixed top-4 right-4 border-l-4 rounded-lg shadow-lg z-50 max-w-md ${getBgColor(notification.type)}`}>
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 mr-3 mt-0.5">
            {getIcon(notification.type)}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">
              {notification.type === 'error' && <span className="text-red-800">{notification.title}</span>}
              {notification.type === 'success' && <span className="text-green-800">{notification.title}</span>}
              {notification.type === 'warning' && <span className="text-yellow-800">{notification.title}</span>}
              {notification.type === 'info' && <span className="text-blue-800">{notification.title}</span>}
            </h3>
            <p className={`text-sm mb-3 ${
              notification.type === 'error' ? 'text-red-700' :
              notification.type === 'success' ? 'text-green-700' :
              notification.type === 'warning' ? 'text-yellow-700' :
              'text-blue-700'
            }`}>
              {notification.message}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className={`flex-shrink-0 ml-2 ${
              notification.type === 'error' ? 'text-red-500 hover:text-red-700' :
              notification.type === 'success' ? 'text-green-500 hover:text-green-700' :
              notification.type === 'warning' ? 'text-yellow-500 hover:text-yellow-700' :
              'text-blue-500 hover:text-blue-700'
            } transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
