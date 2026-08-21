import Foundation

// ─────────────────────────────────────────────────────────────────────────────
// Les textes du widget, dans la langue choisie DANS L'APP.
//
// Pas de `Localizable.strings`, volontairement. Le catalogue d'Apple résout la
// langue à partir des réglages du SYSTÈME, or ce n'est pas la bonne source
// ici : quelqu'un peut mettre HYDRA en anglais sur un iPhone en français, et
// l'écran verrouillé afficherait alors « TU SÈCHES » à côté d'une app en
// anglais. La langue voyage donc dans le snapshot de l'App Group, écrit par
// l'app à chaque synchronisation, exactement comme le statut d'abonnement.
//
// Ces chaînes DOIVENT rester alignées sur src/i18n/strings.ts — c'est le même
// widget, une fois en Swift et une fois en maquette React Native.
// ─────────────────────────────────────────────────────────────────────────────

enum HydraLang: String {
    case fr
    case en

    /// Tout ce qui n'est pas explicitement `en` retombe en français : c'est la
    /// langue d'origine du produit, et un snapshot écrit par une version
    /// antérieure de l'app ne porte pas encore le champ.
    static func from(_ raw: String?) -> HydraLang {
        HydraLang(rawValue: (raw ?? "").lowercased()) ?? .fr
    }
}

enum HydraCopy {
    static func zonePoisoned(_ l: HydraLang) -> String {
        l == .en ? "POISONED" : "EMPOISONNÉ"
    }
    static func zoneRed(_ l: HydraLang) -> String {
        l == .en ? "CRITICAL" : "CRITIQUE"
    }
    static func zoneAmber(_ l: HydraLang) -> String {
        l == .en ? "DRYING OUT" : "TU SÈCHES"
    }
    static func zoneGreen(_ l: HydraLang) -> String {
        l == .en ? "HYDRATED" : "HYDRATÉ"
    }

    static func water(_ l: HydraLang) -> String {
        l == .en ? "＋ WATER" : "＋ EAU"
    }
    static func alcoholLight(_ l: HydraLang) -> String {
        l == .en ? "LIGHT" : "LÉGER"
    }
    static func alcoholMedium(_ l: HydraLang) -> String {
        l == .en ? "MEDIUM" : "MOYEN"
    }
    static func alcoholStrong(_ l: HydraLang) -> String {
        l == .en ? "STRONG" : "FORT"
    }
}
