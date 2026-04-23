import { useState } from 'react';
import ConfirmModal from '../components/common/ConfirmModal';
import AlertModal from '../components/common/AlertModal';

export function useModals() {
    const [confirm, setConfirm] = useState(null);
    const [alert, setAlert] = useState(null);

    const showConfirm = (message, onConfirm, danger = true) =>
        setConfirm({ message, onConfirm, danger });

    const showAlert = (message) => setAlert(message);

    const modals = (
        <>
            {confirm && (
                <ConfirmModal
                    message={confirm.message}
                    danger={confirm.danger}
                    onConfirm={() => { confirm.onConfirm(); setConfirm(null); }}
                    onCancel={() => setConfirm(null)}
                />
            )}
            {alert && (
                <AlertModal message={alert} onClose={() => setAlert(null)} />
            )}
        </>
    );

    return { showConfirm, showAlert, modals };
}