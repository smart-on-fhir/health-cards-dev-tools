// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/*
    These mappings are for testing SMART Health Link downloads without a server. 
    The download utility function (utils.ts post() and get()) will lookup a URL here first. 
    If it finds it, it returns the value here and does not actually download anything from the actual url.

    These can be generated with node ./js/src/shlEncode.js (after un-commenting the bottom section)

*/


// NOTE: we're no longer using the mechanism for testing now that we're using a live shl-server
//       however, we're leaving the functionality in place for possible future use.

const response = {

    // "https://test-link/5qlQEV1xjub56cF4CrVN2B9KnNyGxYxEKeOY0cjo2h4": (): ShlinkManifest => {
    //     return {
    //         "files": [
    //             { "contentType": "application/smart-health-card", "location": "https://api.vaxx.link/api/shl/by5HVbFSsGhpAJyAQ2SxqIn81mzVlut6pHMHUMU42r8/file/0" },
    //             { "contentType": "application/smart-health-card", "location": "https://api.vaxx.link/api/shl/by5HVbFSsGhpAJyAQ2SxqIn81mzVlut6pHMHUMU42r8/file/1" },
    //             { "contentType": "application/smart-health-card", "location": "https://api.vaxx.link/api/shl/by5HVbFSsGhpAJyAQ2SxqIn81mzVlut6pHMHUMU42r8/file/2" }
    //         ]
    //     }
    // },
    // "https://api.vaxx.link/api/shl/by5HVbFSsGhpAJyAQ2SxqIn81mzVlut6pHMHUMU42r8/file/0": "eyJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiZGlyIiwia2lkIjoiQnhEVUxFTVRSXzZ4MU1yc0dweGYyUU1iTy1fY01zTEY5Sk1XckxHSnkwVSJ9..TaZuFgqEVrZbrw98.R9TGt_2uvh6BJvy-4eJOCLjHo7_1GW7SOOsADm_1B13LvZM2PeEwRp27iIi41lIDqVMRJwd6ZzKIzv7Fl3M-1svyRckUdGNWbA0KhR5OI4GFAAiuPDTdnzYkrxOILooMl7ZIN-oKaisR352JoZuzD7ZABwjybtg4YItZ3-YeWHjbiR1dAcdeSNjY94Ut4XbrJTWpfGvx5WAo3wXdcbjaVAKQIX3D7xczPDG4EU5xVjuzc9k7prk1C3lnFkedbFFIxVCGAj4ufF-yAAdLqDAR4v5crLwFDzJi7AjH3FbZxwdVo5rM7sjNghTJNk-ElLTgP_Ik5LARP6qNh4TJtmZk_n4WBNgCoNKSSQ9aBEauzzgEm8AbKnLWuvcgQy0sLenoIVLdV63zFgSu46WbryJM4aP6TVhlIqnx3_tH2sCj_WbwUSAmBlKQNAFklRpJ5A6bsd4f7hDgOWyiX4gbRY9i1vk4zaTKte_E2Q-5TVQ08Tf5I4hYUqVoL4HeTk3v-kd8_bzVxvwDWhbD79-dUr3Fz-hjvqzXfsdX3tiur4GhBvE4HO1V12xMU93eFf3ZGgxEvNnjvs_8NSplDRyhoYl1f09gj8saeDA6u5ry6sLxG3K9QUKyoDCWMjv0_W2bEWYYVUYSS8bkXxrzLSAI_5paF2FGsrtbueOs5zpGAYB9-8hm9qVZjr8YqGwCqHhV4cxnS0P55oK4hcurD3tR1z8rhBPWId6dF6ytzJBu74qkQ8yYC5EUUb7RlUMz8q0KNcK8Huw-x0H4zk480GMZFXKDxV_Hp6kKggyMkEgoiqwZbwgzqkCJ7GaRSqyVpk_Veno4WF4Q3kyEu-xrG3NCFHHu9xOSps9YMrct6_nkXfNoYesysrINdcyjBcF6dBpNvjzUO7uOnNDWoQXvsRlWIK5ZeNvLkF4aFX-0SM8Qndsgw6BJtJoRaxlUrfVscaGsYaanEd_jjV6KecNw14QfRCcymuTGCDfI.Q0ZPPGirc8DgXEgdemVVUQ",
    // "https://api.vaxx.link/api/shl/by5HVbFSsGhpAJyAQ2SxqIn81mzVlut6pHMHUMU42r8/file/1": "eyJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiZGlyIiwia2lkIjoiQnhEVUxFTVRSXzZ4MU1yc0dweGYyUU1iTy1fY01zTEY5Sk1XckxHSnkwVSJ9..wfC3tSJDtzcsRRHX.LS_9oBObhswe2_RU5kSeuD4DQYSxr4-XraRlOfjH2h7rhLUqivuOOTkwJD8SZvlwFTK93AprpmbPF0vakWH2oGu9msAr6MV0w-rxzt9mwmjGLS2bJ8tJXKFQ0MrZvJ28H8fQKgoV2bILPNeOO1LryDW8iulUT3XPM6amhxq0dNziA2D4VJneLW4pnKQ_qbjsZEZ3jOk9kw0fEq5WrxiWSGMJYNLZ0ZuNBgylGtNVNW6Dv1Z2FBDq_x9AHeni49F2hx-uVv39Bl0iqCZDPtBDK3Ipr8r6m_IAHeVVOuPLCRFomvxXZQIuPpx8GpA5TkvpQ--xhBAnTiUVVO0IlFnbAn68GKLuoswYWnfwNnZcSg4RARkQ-x7HElWfplQjiq6lsNYnWR2PvfJloWdw5LvYZrR4Bx7OuW-wea3mgElLJ5Zk-4kS-VtJwtt0iAQn5i2bsxV1bb8dajRx44sfHcpacvm-XA2dOmVX8ty4SFYRRC9dbzJR-LD13NoVN2UAVO0eMZEGxBx2-h9NfTakPUNT6_IrnPetI_B30uXC03cjmt-5zueRskbbn2pxChzrbzdXUM2DE3PNckQKne7OYk8f8iKFes8pwM1I4_sYhaJAkusG3v4mpRARg907v_zJOCdgEdNHky5-o9oH6mtqxWOq_t1aeBA9I7c5Svr34z6tAllXeJ0P9DPIynl1L6_eU-Yge5nb4sGvyxrgLFzjzgL_-K5da7hv2GZ51vSJrRh9ahPYRTHL_nwLrmhAdf8fQu1aeaDE91tRK4PX8xBVuNw8D9IPhAGfG1yGe9SF7ltWkWkPUU9FIz6d5Frs4XYDrkYxo7EWnW5kRqXGW_FinPKdOF1IcTA4Opt_zv-rCcpEa5pPTTNYdz_c7V2DcQp3y12LSyBQ65jIaO-j-s4_zjFx0dUB1itvEqzSAOHmpZTbHi6XQzkUOGg-mWcWJukdbwIgsm3N5pCnEQkcNLC-xX5VCww4ErYj23fzQBsXebhbGOzqrt4.6W3AOFxRQofrD9P8gXSDeQ",
    // "https://api.vaxx.link/api/shl/by5HVbFSsGhpAJyAQ2SxqIn81mzVlut6pHMHUMU42r8/file/2": "eyJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiZGlyIiwia2lkIjoiQnhEVUxFTVRSXzZ4MU1yc0dweGYyUU1iTy1fY01zTEY5Sk1XckxHSnkwVSJ9..BR1u3mufNqG0lV2U.lU06RKxLrT9yj2aO3v00FpBGDCFrlZpHQJgncb6jNBr25ajLJjcLost5t4oP4F9bL-2oJ_wyYS7tUDPmS1h6_Vd6JKKUZY-aSVh85i6z2CzSfHoF83A--fOJwOrIvNjlIIXCTHtR2eHyMQ66m6mUtbKTQ4HE8tyl3b-314s-Yz5AsEmBasTib2eeqEKR4GI-NfEPnelnK-5hOQ2KtvJZyl13jkmnbgCK2ghieJjxDrwpzTluOqqULgBi5Kjp2b_pSTOBnig3Kt9v_mp0JH5cfJqLkBJrpw560h6grgJv0ZeCEzNRR3W_jcqCtX_fKuSUImjnu8PklHDBOQPuAFm4Gpnl6rs1oACE4Rybt9IVF0QG7TF5tgoxIQg2jVp5JOtlBkEzRbxPNcnJCxRaYmytEqxNwmqBEZW1nnmOMzsaMwmxIIZPpYsETPCwXt6MppUJinEf0VDfLdM4QYG0isxcxMR1kGmrJHYwz2stJqvNPPPz6YBqa3cF98o1ZsrJloAzTQXr1d5JoXr-o6JJtdGecDDHTSkvNKG_IUSHhAQrK2PCbTbZmhkn5SthSraHPJrvkQivpGaYd4bQTf6J55wIHa9cRr3JAQRechSZvclUovbl9NOTvE0Cy9my7R3-8WJ3sYkZd3drv-Ib1IESgVXjW_CeMQsvgLmuHsApL4ktR704COP_2Wcx8nClDPwLyEW3x7xWCCtIdqIwZIN_Kcqo14FdPiBFuPDQXvPMtfdJ14xMoZ1oWAfccgrBzuOeNz77Em-OWPHZUJVVrilZD0dHQined6RRx_5UbXTUgFTMAwuw47pW09aPGWKGz9YIYJUZ_bku7e717hfpU4cDUqv2rPs7zwJUQaQ0NMENQoz3PkR6glpLZmMQtw0I4aXEkpt_qBHvEZESPBe939uSOpObk3yUbBtshucglG1tIGyo5qVfY4hSzpit7DBGomNhPzasqTcAEwsbY4JVOTVIIaaqI5A5jIcbjV5yJO580EkRNwyGfg.0D9gM-4OeHQDlyP0XvPbbw",

}

export default response;