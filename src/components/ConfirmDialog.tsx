import { useStore } from "../store/store";
import { useT } from "../lib/i18n";
import { settleConfirm } from "../lib/confirm";
import { Modal } from "./common";

/** Renders the pending in-app confirmation request (replaces window.confirm). */
export function ConfirmDialog() {
  const t = useT();
  const request = useStore((s) => s.confirmRequest);
  if (!request) return null;

  return (
    <Modal title={request.message} onClose={() => settleConfirm(false)}>
      {request.detail && <p className="confirm__detail">{request.detail}</p>}
      <div className="confirm__actions">
        <button className="btn btn--ghost" onClick={() => settleConfirm(false)}>
          {t("common.cancel")}
        </button>
        <button
          className="btn btn--danger"
          autoFocus
          onClick={() => settleConfirm(true)}
        >
          {t("common.confirmBtn")}
        </button>
      </div>
    </Modal>
  );
}
