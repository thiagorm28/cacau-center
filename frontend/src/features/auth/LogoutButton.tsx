import { PillButton } from "../../components/ui/PillButton";
import { useSession } from "../../session/SessionContext";

/**
 * Ação de sair, slotada no `header` de cada `Screen` (US-002.AC-1): fica sobre o
 * cabeçalho chocolate, então usa a pílula creme/terracota do `DESIGN.md` — o passo 700
 * do acento sobre o preenchimento 100 é o par legível para texto pequeno.
 */
export function LogoutButton() {
  const { signOut } = useSession();
  return (
    <div className="mt-6 flex justify-end">
      <PillButton variant="secondary" onClick={() => void signOut()}>
        Sair
      </PillButton>
    </div>
  );
}
