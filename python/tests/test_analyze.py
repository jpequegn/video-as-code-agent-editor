import pytest
from vace_media.analyze import parse_volume_detect


def test_parse_volume_detect() -> None:
    levels = parse_volume_detect("mean_volume: -21.4 dB\nmax_volume: -2.1 dB")
    assert levels.mean_db == -21.4
    assert levels.peak_db == -2.1


def test_parse_volume_detect_requires_both_values() -> None:
    with pytest.raises(ValueError, match="volume observations"):
        parse_volume_detect("max_volume: -2.1 dB")
