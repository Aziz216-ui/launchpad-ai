package com.launchpad.finance.domain.model;

import com.launchpad.finance.domain.exception.DonneesInvalides;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FormatExportTest {

    @Test
    void resout_le_format_depuis_l_extension_sans_tenir_compte_de_la_casse() {
        assertThat(FormatExport.depuisExtension("pdf")).isEqualTo(FormatExport.PDF);
        assertThat(FormatExport.depuisExtension(" XLSX ")).isEqualTo(FormatExport.EXCEL);
    }

    @Test
    void refuse_un_format_inconnu_ou_absent() {
        assertThatThrownBy(() -> FormatExport.depuisExtension("docx")).isInstanceOf(DonneesInvalides.class);
        assertThatThrownBy(() -> FormatExport.depuisExtension(null)).isInstanceOf(DonneesInvalides.class);
    }

    @Test
    void cle_de_stockage_deterministe() {
        UUID id = UUID.fromString("22222222-2222-2222-2222-222222222222");
        assertThat(FormatExport.PDF.cleStockage(id)).isEqualTo("22222222-2222-2222-2222-222222222222.pdf");
        assertThat(FormatExport.EXCEL.cleStockage(id)).endsWith(".xlsx");
    }
}
